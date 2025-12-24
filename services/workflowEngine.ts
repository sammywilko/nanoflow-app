import { WorkflowNode, NodeConnection, NodeType, NodeStatus } from '../types';
import * as geminiService from './geminiService';
import { nodeCache } from './nodeCache';

export interface ExecutionResult {
  success: boolean;
  error?: string;
}

type NodeUpdateCallback = (nodeId: string, updates: Partial<WorkflowNode>) => void;

/**
 * Variable expansion helper for {{var}} syntax
 */
function expandVariables(template: string, variables: Record<string, string[]>): string[] {
  const varNames = Object.keys(variables);
  if (varNames.length === 0) return [template];

  // Generate all combinations
  let combinations: Record<string, string>[] = [{}];
  for (const varName of varNames) {
    const values = variables[varName] || [];
    const newCombinations: Record<string, string>[] = [];
    for (const combo of combinations) {
      for (const value of values) {
        newCombinations.push({ ...combo, [varName]: value });
      }
    }
    combinations = newCombinations;
  }

  // Apply each combination to template
  return combinations.map(combo => {
    let result = template;
    for (const [key, value] of Object.entries(combo)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
    return result;
  });
}

/**
 * Workflow Engine - Executes node graphs in topological order
 */
export class WorkflowEngine {
  private nodes: WorkflowNode[];
  private connections: NodeConnection[];
  private onNodeUpdate: NodeUpdateCallback;
  private nodeResults: Map<string, any>;

  constructor(
    nodes: WorkflowNode[],
    connections: NodeConnection[],
    onNodeUpdate: NodeUpdateCallback
  ) {
    this.nodes = nodes;
    this.connections = connections;
    this.onNodeUpdate = onNodeUpdate;
    this.nodeResults = new Map();
  }

  /**
   * Validate the workflow - check for cycles and unconnected required inputs
   */
  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check for cycles using DFS
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCycle = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const outgoingConnections = this.connections.filter(c => c.sourceNodeId === nodeId);
      for (const conn of outgoingConnections) {
        if (!visited.has(conn.targetNodeId)) {
          if (hasCycle(conn.targetNodeId)) return true;
        } else if (recursionStack.has(conn.targetNodeId)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of this.nodes) {
      if (!visited.has(node.id) && hasCycle(node.id)) {
        errors.push('Workflow contains a cycle - nodes cannot be connected in a loop');
        break;
      }
    }

    // Check for unconnected required inputs
    for (const node of this.nodes) {
      // Skip input nodes - they don't need connections
      if (node.type === NodeType.IMAGE_INPUT ||
          node.type === NodeType.TEXT_INPUT ||
          node.type === NodeType.TEXT_ARRAY_INPUT) {
        continue;
      }

      // BATCH_GENERATE can work standalone with useVariables mode
      if (node.type === NodeType.BATCH_GENERATE && node.config.useVariables) {
        continue;
      }

      // GENERATE can work standalone with prompt in config
      if (node.type === NodeType.GENERATE && node.config.prompt?.trim()) {
        continue;
      }

      // For other nodes, check if at least one input is connected
      const hasConnection = this.connections.some(c => c.targetNodeId === node.id);
      if (!hasConnection && node.inputs.length > 0) {
        errors.push(`${node.type} node requires at least one input connection`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Get topologically sorted execution order
   */
  getExecutionOrder(): WorkflowNode[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    // Initialize
    for (const node of this.nodes) {
      inDegree.set(node.id, 0);
      adjacency.set(node.id, []);
    }

    // Build graph
    for (const conn of this.connections) {
      const targets = adjacency.get(conn.sourceNodeId) || [];
      targets.push(conn.targetNodeId);
      adjacency.set(conn.sourceNodeId, targets);
      inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) || 0) + 1);
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
      if (degree === 0) queue.push(nodeId);
    }

    const order: WorkflowNode[] = [];
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = this.nodes.find(n => n.id === nodeId);
      if (node) order.push(node);

      for (const targetId of adjacency.get(nodeId) || []) {
        const newDegree = (inDegree.get(targetId) || 0) - 1;
        inDegree.set(targetId, newDegree);
        if (newDegree === 0) queue.push(targetId);
      }
    }

    return order;
  }

  /**
   * Get inputs for a node from its connections
   */
  private getNodeInputs(node: WorkflowNode): Map<string, any> {
    const inputs = new Map<string, any>();

    for (const port of node.inputs) {
      // Find connection to this port
      const conn = this.connections.find(
        c => c.targetNodeId === node.id && c.targetPortId === port.id
      );

      if (conn) {
        // Get result from source node
        const sourceResult = this.nodeResults.get(conn.sourceNodeId);
        if (sourceResult !== undefined) {
          // For nodes with multiple outputs, we store them as an object
          if (typeof sourceResult === 'object' && sourceResult !== null && port.name in sourceResult) {
            inputs.set(port.id, sourceResult[port.name]);
          } else {
            inputs.set(port.id, sourceResult);
          }
        }
      }
    }

    return inputs;
  }

  /**
   * Execute a single node
   */
  async executeNode(node: WorkflowNode, inputs: Map<string, any>): Promise<any> {
    switch (node.type) {
      case NodeType.IMAGE_INPUT:
        return node.config.imageData || null;

      case NodeType.TEXT_INPUT:
        return node.config.text || '';

      case NodeType.GENERATE: {
        // Get prompt from connection or use built-in config prompt
        const connectedPrompt = inputs.get(node.inputs[0]?.id);
        const prompt = connectedPrompt || node.config.prompt || '';

        if (!prompt.trim()) {
          throw new Error('Generate node requires a prompt - either type one in or connect a Prompt node');
        }

        const reference = inputs.get(node.inputs[1]?.id);
        const references = reference ? [reference] : [];

        return await geminiService.generateGenericImage(
          prompt,
          references,
          node.config.aspectRatio || '1:1',
          node.config.quality || '2K'
        );
      }

      case NodeType.STYLE_TRANSFER: {
        const content = inputs.get(node.inputs[0]?.id);
        const style = inputs.get(node.inputs[1]?.id);

        if (!content || !style) {
          throw new Error('Style transfer requires both content and style images');
        }

        return await geminiService.applyStyleTransfer(content, style);
      }

      case NodeType.UPSCALE: {
        const image = inputs.get(node.inputs[0]?.id);
        if (!image) throw new Error('Upscale requires an input image');

        return await geminiService.editImageVariation(
          image,
          `Upscale to ${node.config.targetSize || '4K'}, enhance details, high resolution, photorealistic`,
          node.config.targetSize || '4K'
        );
      }

      case NodeType.ANALYZE: {
        const image = inputs.get(node.inputs[0]?.id);
        if (!image) throw new Error('Analyze requires an input image');

        const analysis = await geminiService.analyzeImage(image);
        return {
          palette: analysis.colors,
          keywords: analysis.keywords.join(', '),
          description: analysis.description
        };
      }

      case NodeType.COMPOSITE: {
        const images: string[] = [];
        for (const port of node.inputs.filter(p => p.type === 'image')) {
          const img = inputs.get(port.id);
          if (img) images.push(img);
        }

        const prompt = inputs.get(node.inputs.find(p => p.type === 'text')?.id) || '';

        if (images.length < 2) {
          throw new Error('Composite requires at least 2 input images');
        }

        return await geminiService.smartCompose(images, prompt);
      }

      case NodeType.OUTPUT: {
        // Output node just passes through
        return inputs.get(node.inputs[0]?.id) || null;
      }

      case NodeType.INPAINT: {
        const image = inputs.get(node.inputs[0]?.id);
        const prompt = inputs.get(node.inputs.find(p => p.type === 'text')?.id) || '';

        if (!image) throw new Error('Inpaint requires an input image');

        // For now, use editImageVariation as a fallback
        // TODO: Implement proper inpainting with mask
        return await geminiService.editImageVariation(
          image,
          prompt,
          node.config.quality || '2K'
        );
      }

      case NodeType.TEXT_ARRAY_INPUT: {
        // Return array of prompts from config
        return (node.config.prompts || []).filter((p: string) => p.trim());
      }

      case NodeType.BATCH_GENERATE: {
        // Get prompts from connection or config
        const connectedPrompts = inputs.get(node.inputs[0]?.id) as string[] | undefined;
        let prompts = connectedPrompts || node.config.prompts || [];

        // Handle variable expansion if enabled
        if (node.config.useVariables && node.config.promptText) {
          prompts = expandVariables(node.config.promptText, node.config.variables || {});
        }

        prompts = prompts.filter((p: string) => p.trim());

        if (prompts.length === 0) {
          throw new Error('Batch Generate requires at least one prompt');
        }

        // Generate all images (with optional parallelism limiting)
        const results: string[] = [];
        const limit = node.config.parallelLimit || 3;

        for (let i = 0; i < prompts.length; i += limit) {
          const batch = prompts.slice(i, i + limit);
          const batchResults = await Promise.all(
            batch.map((prompt: string) =>
              geminiService.generateGenericImage(
                prompt,
                [],
                node.config.aspectRatio || '1:1',
                node.config.quality || '2K'
              )
            )
          );
          results.push(...batchResults);
        }

        return results; // Array of base64 images
      }

      case NodeType.COMPARE_GRID: {
        const images = inputs.get(node.inputs[0]?.id) as string[] | undefined;

        if (!images || images.length === 0) {
          throw new Error('Compare Grid requires image array input');
        }

        // Store images for display
        // If user has selected one, the selected image will be used as output
        const selectedIndex = node.config.selectedIndex;
        if (selectedIndex !== null && selectedIndex !== undefined && selectedIndex < images.length) {
          // Return the selected image for downstream nodes, but also store all images
          return { images, selected: images[selectedIndex] };
        }

        // No selection yet - return images array for display, first image as default output
        return { images, selected: images[0] };
      }

      default:
        throw new Error(`Unknown node type: ${node.type}`);
    }
  }

  /**
   * Execute the entire workflow
   */
  async execute(useCache: boolean = true): Promise<ExecutionResult> {
    // Validate first
    const validation = this.validate();
    if (!validation.valid) {
      return { success: false, error: validation.errors.join('; ') };
    }

    // Get execution order
    const order = this.getExecutionOrder();
    this.nodeResults.clear();

    // Execute each node in order
    for (const node of order) {
      try {
        // Update status to running
        this.onNodeUpdate(node.id, { status: 'running' as NodeStatus });

        // Get inputs from connected nodes
        const inputs = this.getNodeInputs(node);

        // Check cache first
        if (useCache) {
          const inputHash = nodeCache.hashInputs(node, inputs);
          const cachedResult = nodeCache.get(node.id, inputHash);

          if (cachedResult !== null) {
            // Use cached result
            this.nodeResults.set(node.id, cachedResult);

            // Determine what to show as result
            let displayResult: any = undefined;
            if (typeof cachedResult === 'string') {
              displayResult = cachedResult;
            } else if (Array.isArray(cachedResult)) {
              displayResult = cachedResult;
            } else if (cachedResult?.images) {
              displayResult = cachedResult;
            }

            this.onNodeUpdate(node.id, {
              status: 'complete' as NodeStatus,
              result: displayResult,
              error: undefined,
              config: { ...node.config, _cached: true }
            });
            continue; // Skip execution
          }
        }

        // Execute the node
        const result = await this.executeNode(node, inputs);

        // Store in cache
        if (useCache) {
          const inputHash = nodeCache.hashInputs(node, inputs);
          nodeCache.set(node.id, inputHash, result, node.type);
        }

        // Store result
        this.nodeResults.set(node.id, result);

        // Determine what to show as result
        let displayResult: any = undefined;
        if (typeof result === 'string') {
          displayResult = result;
        } else if (Array.isArray(result)) {
          displayResult = result;
        } else if (result?.images) {
          displayResult = result;
        }

        // Update node with result
        this.onNodeUpdate(node.id, {
          status: 'complete' as NodeStatus,
          result: displayResult,
          error: undefined,
          config: { ...node.config, _cached: false }
        });

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        this.onNodeUpdate(node.id, {
          status: 'error' as NodeStatus,
          error: errorMessage
        });

        return { success: false, error: `Failed at ${node.type}: ${errorMessage}` };
      }
    }

    return { success: true };
  }

  /**
   * Execute a single node and its dependencies
   */
  async executeFromNode(nodeId: string): Promise<ExecutionResult> {
    // Find all nodes that this node depends on
    const dependencies = new Set<string>();
    const collectDependencies = (id: string) => {
      const incoming = this.connections.filter(c => c.targetNodeId === id);
      for (const conn of incoming) {
        if (!dependencies.has(conn.sourceNodeId)) {
          dependencies.add(conn.sourceNodeId);
          collectDependencies(conn.sourceNodeId);
        }
      }
    };
    collectDependencies(nodeId);

    // Get execution order for dependencies + target node
    const fullOrder = this.getExecutionOrder();
    const relevantNodes = fullOrder.filter(
      n => dependencies.has(n.id) || n.id === nodeId
    );

    // Execute
    for (const node of relevantNodes) {
      try {
        this.onNodeUpdate(node.id, { status: 'running' as NodeStatus });
        const inputs = this.getNodeInputs(node);
        const result = await this.executeNode(node, inputs);
        this.nodeResults.set(node.id, result);
        this.onNodeUpdate(node.id, {
          status: 'complete' as NodeStatus,
          result: typeof result === 'string' ? result : undefined
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.onNodeUpdate(node.id, { status: 'error' as NodeStatus, error: errorMessage });
        return { success: false, error: errorMessage };
      }
    }

    return { success: true };
  }
}

export default WorkflowEngine;
