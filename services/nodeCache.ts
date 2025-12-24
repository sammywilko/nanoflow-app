import { WorkflowNode } from '../types';

interface CacheEntry {
  inputHash: string;
  result: any;
  timestamp: number;
  nodeType: string;
}

const CACHE_KEY = 'nanoflow_node_cache';
const MAX_CACHE_SIZE = 50;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export class NodeCache {
  private cache: Map<string, CacheEntry>;

  constructor() {
    this.cache = this.loadFromStorage();
  }

  private loadFromStorage(): Map<string, CacheEntry> {
    try {
      const stored = localStorage.getItem(CACHE_KEY);
      if (stored) {
        const entries = JSON.parse(stored) as [string, CacheEntry][];
        const now = Date.now();
        const valid = entries.filter(([_, entry]) => now - entry.timestamp < CACHE_TTL);
        return new Map(valid);
      }
    } catch (e) {
      console.warn('Failed to load node cache:', e);
    }
    return new Map();
  }

  private saveToStorage(): void {
    try {
      const entries = Array.from(this.cache.entries());
      if (entries.length > MAX_CACHE_SIZE) {
        entries.sort((a, b) => b[1].timestamp - a[1].timestamp);
        entries.splice(MAX_CACHE_SIZE);
      }
      localStorage.setItem(CACHE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('Failed to save node cache:', e);
    }
  }

  /**
   * Generate hash for node inputs
   */
  hashInputs(node: WorkflowNode, inputs: Map<string, any>): string {
    const hashData = {
      type: node.type,
      config: node.config,
      inputs: Object.fromEntries(inputs)
    };
    // Simple hash using btoa
    try {
      return btoa(JSON.stringify(hashData)).slice(0, 32);
    } catch {
      // Handle binary data that can't be stringified
      return btoa(node.type + JSON.stringify(node.config)).slice(0, 32);
    }
  }

  /**
   * Get cached result if inputs match
   */
  get(nodeId: string, inputHash: string): any | null {
    const entry = this.cache.get(nodeId);
    if (entry && entry.inputHash === inputHash) {
      return entry.result;
    }
    return null;
  }

  /**
   * Store result in cache
   */
  set(nodeId: string, inputHash: string, result: any, nodeType: string): void {
    this.cache.set(nodeId, {
      inputHash,
      result,
      timestamp: Date.now(),
      nodeType
    });
    this.saveToStorage();
  }

  /**
   * Invalidate cache for a node
   */
  invalidate(nodeId: string): void {
    this.cache.delete(nodeId);
    this.saveToStorage();
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    localStorage.removeItem(CACHE_KEY);
  }

  /**
   * Check if node has cached result
   */
  has(nodeId: string): boolean {
    return this.cache.has(nodeId);
  }
}

export const nodeCache = new NodeCache();
