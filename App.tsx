
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { CanvasItem, ItemType, Point, ViewState, SelectionBox, ProjectPlan, ShotConcept } from './types';
import * as geminiService from './services/geminiService';
import { setApiKey, hasApiKey as checkHasApiKey } from './services/geminiService';
import { screenToWorld, getSmartPosition, generateId, snapToGrid, isIntersecting } from './utils/canvasUtils';
import CanvasItemComponent from './components/CanvasItem';
import Toolbar from './components/Toolbar';
import ProjectSidebar from './components/ProjectSidebar';
import PropertiesPanel from './components/PropertiesPanel';
import PromptBar from './components/PromptBar';
import WorkflowCanvas from './components/WorkflowCanvas';
import { Sparkles, GitBranch } from 'lucide-react';

// Constants
const MIN_SCALE = 0.1;
const MAX_SCALE = 3;
const GRID_SIZE = 24;

type AppMode = 'canvas' | 'workflow';

const App: React.FC = () => {
  // --- State ---

  // App Mode
  const [appMode, setAppMode] = useState<AppMode>('canvas');

  // Project State
  const [projectPlan, setProjectPlan] = useState<ProjectPlan | null>(null);
  const [referenceImages, setReferenceImages] = useState<string[]>([]);
  const [isPlanning, setIsPlanning] = useState(false);
  
  // History Stacks
  const [history, setHistory] = useState<CanvasItem[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Derived current items
  const items = history[historyIndex];

  const [viewState, setViewState] = useState<ViewState>({ x: window.innerWidth / 2 + 160, y: window.innerHeight / 2, scale: 1 }); // Offset for sidebar
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  
  // API Key Check
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Rubber Band Selection
  const [selectionBox, setSelectionBox] = useState<SelectionBox | null>(null);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const dragInfo = useRef<{
    mode: 'IDLE' | 'DRAG_ITEM' | 'PAN' | 'SELECT_BOX';
    startX: number;
    startY: number;
    initialView: ViewState;
    initialItemPos: Map<string, Point>;
    targetId: string | null;
  }>({
    mode: 'IDLE',
    startX: 0,
    startY: 0,
    initialView: { x: 0, y: 0, scale: 1 },
    initialItemPos: new Map(),
    targetId: null,
  });

  const isSpacePressed = useRef(false);

  // --- Initialization ---

  useEffect(() => {
    // Check if API key exists (from env or localStorage)
    setHasApiKey(checkHasApiKey());
  }, []);

  const handleSubmitApiKey = () => {
    if (!apiKeyInput.trim()) return;
    setIsSubmitting(true);
    setApiKey(apiKeyInput.trim());
    setHasApiKey(true);
    setIsSubmitting(false);
  };

  // --- History Management ---

  const pushToHistory = useCallback((newItems: CanvasItem[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newItems);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsPresentationMode(false);
      if (e.code === 'Space') {
        isSpacePressed.current = true;
        if (containerRef.current) containerRef.current.style.cursor = 'grab';
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedIds.size > 0 && !isGenerating) {
              const itemsToDelete = items.filter(i => selectedIds.has(i.id) && !i.locked);
              if (itemsToDelete.length > 0) {
                const newItems = items.filter(i => !selectedIds.has(i.id) || i.locked);
                pushToHistory(newItems);
                const lockedSelection = new Set<string>();
                items.forEach(i => {
                    if (selectedIds.has(i.id) && i.locked) lockedSelection.add(i.id);
                });
                setSelectedIds(lockedSelection);
              }
          }
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        isSpacePressed.current = false;
        if (containerRef.current) containerRef.current.style.cursor = 'default';
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [items, selectedIds, history, historyIndex, pushToHistory, isGenerating]);


  // --- GENERATION HANDLERS ---

  const handleCreateProject = async (brief: string) => {
      // CLEAR OLD CONTEXT
      if(!brief) {
          handleResetProject();
          return;
      }
      
      setIsPlanning(true);
      try {
          const plan = await geminiService.planProject(brief, referenceImages);
          setProjectPlan(plan);
          
          const center = screenToWorld({x: window.innerWidth/2 + 160, y: window.innerHeight/2}, viewState);
          const newItems = [...items];
          
          newItems.push({
              id: generateId(),
              type: ItemType.TEXT,
              position: { x: center.x, y: center.y - 400 },
              size: { width: 600, height: 100 },
              content: plan.themeName,
              zIndex: 10
          });
          
          newItems.push({
              id: generateId(),
              type: ItemType.PALETTE,
              position: { x: center.x, y: center.y + 400 },
              size: { width: 400, height: 80 },
              content: "Project Palette",
              zIndex: 10,
              metadata: { palette: plan.palette }
          });

          pushToHistory(newItems);
      } catch (e) {
          console.error(e);
          alert("Failed to plan project. Please try again or reduce reference images.");
      } finally {
          setIsPlanning(false);
      }
  };

  const handleResetProject = () => {
    setReferenceImages([]);
    setProjectPlan(null);
  };

  const handleUpdateShot = (id: string, newDesc: string) => {
      if (!projectPlan) return;
      setProjectPlan({
          ...projectPlan,
          shots: projectPlan.shots.map(s => s.id === id ? { ...s, description: newDesc } : s)
      });
  };

  const handleGenerateShot = async (
      shot: ShotConcept, 
      aspectRatio: string, 
      imageSize: "1080p" | "1K" | "2K" | "4K" = "2K", 
      shotIndex: number
    ) => {
      if (!projectPlan) return;
      
      // Mark shot as generating in Sidebar UI
      const updatedShots = projectPlan.shots.map(s => s.id === shot.id ? { ...s, status: 'generating' } : s);
      setProjectPlan({ ...projectPlan, shots: updatedShots as any });

      const center = screenToWorld({x: window.innerWidth/2 + 160, y: window.innerHeight/2}, viewState);
      
      // Deterministic Position based on Index (to allow parallel gen)
      const offset = getSmartPosition(shotIndex, 10);
      const targetPos = { x: center.x + offset.x, y: center.y + offset.y };

      const placeholderId = generateId();
      // Adjust placeholder size based on aspect ratio
      let width = 400;
      let height = 400;
      if (aspectRatio === '16:9') { width = 480; height = 270; }
      if (aspectRatio === '9:16') { width = 270; height = 480; }
      if (aspectRatio === '4:3') { width = 400; height = 300; }
      if (aspectRatio === '3:4') { width = 300; height = 400; }

      const placeholder: CanvasItem = {
          id: placeholderId,
          type: ItemType.IMAGE,
          position: targetPos,
          size: { width, height },
          content: 'loading',
          zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
          metadata: { description: shot.description, tags: [shot.title] }
      };

      pushToHistory([...items, placeholder]);
      const targetIndex = historyIndex + 1;

      try {
          const imageBase64 = await geminiService.generateProjectShot(
              shot.description, 
              projectPlan.styleKeywords, 
              referenceImages,
              aspectRatio,
              imageSize
          );

          setHistory(prev => {
              const copy = [...prev];
              if (targetIndex < copy.length) {
                  copy[targetIndex] = copy[targetIndex].map(i => i.id === placeholderId ? { ...i, content: imageBase64 } : i);
              }
              return copy;
          });

          setProjectPlan(prev => prev ? ({
              ...prev,
              shots: prev.shots.map(s => s.id === shot.id ? { ...s, status: 'done' } : s)
          }) : null);

      } catch (e) {
          console.error(e);
          alert("Generation failed.");
          setHistory(prev => {
            const copy = [...prev];
            if (targetIndex < copy.length) {
                copy[targetIndex] = copy[targetIndex].filter(i => i.id !== placeholderId);
            }
            return copy;
          });
          setProjectPlan(prev => prev ? ({
              ...prev,
              shots: prev.shots.map(s => s.id === shot.id ? { ...s, status: 'pending' } : s)
          }) : null);
      }
  };

  const handleGenerateGenericImage = async (prompt: string, images: string[], aspectRatio: string, imageSize: "1080p"|"1K"|"2K"|"4K" = "2K") => {
    setIsGenerating(true);
    const center = screenToWorld({ x: window.innerWidth/2, y: window.innerHeight/2 }, viewState);
    
    // Size Logic
    let width = 400;
    let height = 400;
    if (aspectRatio === '16:9') { width = 480; height = 270; }
    if (aspectRatio === '9:16') { width = 270; height = 480; }
    if (aspectRatio === '4:3') { width = 400; height = 300; }
    if (aspectRatio === '3:4') { width = 300; height = 400; }

    const id = generateId();
    const placeholder: CanvasItem = {
        id,
        type: ItemType.IMAGE,
        position: center,
        size: { width, height },
        content: 'loading',
        zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
    };
    pushToHistory([...items, placeholder]);
    const targetIndex = historyIndex + 1;

    try {
        const base64 = await geminiService.generateGenericImage(prompt, images, aspectRatio, imageSize);
        setHistory(prev => {
            const copy = [...prev];
            if (targetIndex < copy.length) {
                copy[targetIndex] = copy[targetIndex].map(i => i.id === id ? { ...i, content: base64 } : i);
            }
            return copy;
        });
    } catch (e) {
        alert("Image generation failed.");
        setHistory(prev => {
            const copy = [...prev];
            if (targetIndex < copy.length) {
                copy[targetIndex] = copy[targetIndex].filter(i => i.id !== id);
            }
            return copy;
        });
    } finally {
        setIsGenerating(false);
    }
  };

  const handleGenerateQuickBoard = async (prompt: string, images: string[], aspectRatio: string) => {
     // Re-uses handleCreateProject but initializes automatically
     setReferenceImages(images);
     await handleCreateProject(prompt);
  };

  // --- GENERIC ACTIONS ---

  const handleGenerateVariation = async (id: string, prompt: string) => {
    const item = items.find(i => i.id === id);
    if (!item || item.type !== ItemType.IMAGE) return;

    const varId = generateId();
    const placeholder: CanvasItem = {
        id: varId,
        type: ItemType.IMAGE,
        position: { x: item.position.x + 50, y: item.position.y + 50 },
        size: { ...item.size },
        content: 'loading',
        zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
    };

    pushToHistory([...items, placeholder]);
    const targetIndex = historyIndex + 1;

    try {
        const base64 = await geminiService.editImageVariation(item.content, prompt, "2K");
        setHistory(prev => {
            const copy = [...prev];
            if (targetIndex < copy.length) {
                copy[targetIndex] = copy[targetIndex].map(i => i.id === varId ? { ...i, content: base64 } : i);
            }
            return copy;
        });
    } catch (error) {
        alert("Variation failed.");
    }
  };

  const handleUpscale = async (id: string) => {
      const item = items.find(i => i.id === id);
      if (!item || item.type !== ItemType.IMAGE) return;

      const varId = generateId();
      const placeholder: CanvasItem = {
          id: varId,
          type: ItemType.IMAGE,
          position: { x: item.position.x + 50, y: item.position.y + 50 },
          size: { ...item.size },
          content: 'loading',
          zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
      };

      pushToHistory([...items, placeholder]);
      const targetIndex = historyIndex + 1;

      try {
          const base64 = await geminiService.editImageVariation(item.content, "Upscale to 4K, enhance details, high resolution", "4K");
          setHistory(prev => {
              const copy = [...prev];
              if (targetIndex < copy.length) {
                  copy[targetIndex] = copy[targetIndex].map(i => i.id === varId ? { ...i, content: base64 } : i);
              }
              return copy;
          });
      } catch (error) {
          alert("Upscale failed.");
      }
  };

  // Batch Upload Logic
  const handleBatchUpload = (files: File[], position?: Point) => {
      const startPos = position || screenToWorld({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, viewState);
      const newItems: CanvasItem[] = [];
      const loadedCount = 0;

      files.forEach((file, index) => {
          const reader = new FileReader();
          reader.onload = (e) => {
              const content = e.target?.result as string;
              // Simple grid offset for batch drops
              const offsetX = (index % 3) * 320; 
              const offsetY = Math.floor(index / 3) * 320;
              
              newItems.push({
                  id: generateId(),
                  type: ItemType.IMAGE,
                  position: { x: startPos.x + offsetX, y: startPos.y + offsetY },
                  size: { width: 300, height: 300 },
                  content,
                  zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1 + index,
              });

              // If this is the last one, push to history
              if (newItems.length === files.length) {
                  pushToHistory([...items, ...newItems]);
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const handleAddToContext = (id: string) => {
      const item = items.find(i => i.id === id);
      if (item && item.type === ItemType.IMAGE && item.content !== 'loading') {
          setReferenceImages(prev => {
              // Avoid duplicates
              if (prev.includes(item.content)) return prev;
              if (prev.length >= 8) return prev; // Limit
              return [...prev, item.content];
          });
          // Visual feedback
          alert("Added to Project References");
      }
  };

  const handleDownloadItem = (item: CanvasItem) => {
      if (item.type === ItemType.IMAGE && item.content.startsWith('data:image')) {
          const link = document.createElement('a');
          link.href = item.content;
          link.download = `moodflow-${item.id}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  const handleAddText = () => {
    const newItem: CanvasItem = {
      id: generateId(),
      type: ItemType.TEXT,
      position: screenToWorld({ x: window.innerWidth / 2 + 160, y: window.innerHeight / 2 }, viewState),
      size: { width: 300, height: 100 },
      content: "Double Click to Edit",
      zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
    };
    pushToHistory([...items, newItem]);
  };

  const handleAddNote = () => {
    const newItem: CanvasItem = {
      id: generateId(),
      type: ItemType.NOTE,
      position: screenToWorld({ x: window.innerWidth / 2 + 160, y: window.innerHeight / 2 }, viewState),
      size: { width: 250, height: 250 },
      content: "Note...",
      zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
    };
    pushToHistory([...items, newItem]);
  };

  const handleDelete = (id: string) => {
     let toDelete = new Set<string>();
     if (selectedIds.has(id)) toDelete = new Set(selectedIds);
     else toDelete.add(id);
     const newItems = items.filter(i => !(toDelete.has(i.id) && !i.locked));
     pushToHistory(newItems);
     setSelectedIds(new Set());
  };

  const handleDuplicate = (id: string) => {
    const idsToDupe = selectedIds.has(id) ? Array.from(selectedIds) : [id];
    const newItems = [...items];
    const newSelection = new Set<string>();

    idsToDupe.forEach(sourceId => {
        const item = items.find(i => i.id === sourceId);
        if (item && !item.locked) { 
            const newItemId = generateId();
            newItems.push({
                ...item,
                id: newItemId,
                position: { x: item.position.x + 50, y: item.position.y + 50 },
                zIndex: Math.max(...items.map(i => i.zIndex), 0) + 1,
                locked: false 
            });
            newSelection.add(newItemId);
        }
    });
    pushToHistory(newItems);
    setSelectedIds(newSelection);
  };

  const handleToggleLock = (id: string) => {
      const newItems = items.map(item => item.id === id ? { ...item, locked: !item.locked } : item);
      pushToHistory(newItems);
  };

  const handleBringToFront = (id: string) => {
      const maxZ = Math.max(...items.map(i => i.zIndex), 0);
      const newItems = items.map(item => item.id === id ? { ...item, zIndex: maxZ + 1 } : item);
      pushToHistory(newItems);
  };

  const handleSendToBack = (id: string) => {
      const minZ = Math.min(...items.map(i => i.zIndex), 0);
      const newItems = items.map(item => item.id === id ? { ...item, zIndex: minZ - 1 } : item);
      pushToHistory(newItems);
  };

  const handleGroup = () => {
      if (selectedIds.size < 2) return;
      const newGroupId = generateId();
      const newItems = items.map(item => selectedIds.has(item.id) ? { ...item, groupId: newGroupId } : item);
      pushToHistory(newItems);
  };

  const handleUngroup = () => {
      if (selectedIds.size === 0) return;
      const newItems = items.map(item => selectedIds.has(item.id) ? { ...item, groupId: undefined } : item);
      pushToHistory(newItems);
  };

  const handleSave = () => {
      const data = JSON.stringify({ items, viewState });
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
  };

  const handleLoad = (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
          try {
              const json = JSON.parse(e.target?.result as string);
              if (json.items) {
                  pushToHistory(json.items);
                  if (json.viewState) setViewState(json.viewState);
              }
          } catch (err) { alert("Invalid project file"); }
      };
      reader.readAsText(file);
  };

  // --- PROPERTY PANEL ACTIONS ---
  
  const handleExtractPalette = async (id: string) => {
      const item = items.find(i => i.id === id);
      if (!item || item.type !== ItemType.IMAGE) return;

      const placeholderId = generateId();
      const placeholder: CanvasItem = {
          id: placeholderId,
          type: ItemType.PALETTE,
          position: { x: item.position.x, y: item.position.y + item.size.height/2 + 60 },
          size: { width: item.size.width, height: 60 },
          content: "loading", // Triggers spinner in component
          zIndex: item.zIndex + 1,
      };

      pushToHistory([...items, placeholder]);
      const targetIndex = historyIndex + 1;

      try {
        const analysis = await geminiService.analyzeImage(item.content);
        
        setHistory(prev => {
            const copy = [...prev];
            if (targetIndex < copy.length) {
                copy[targetIndex] = copy[targetIndex].map(i => 
                    i.id === placeholderId ? { 
                        ...i, 
                        content: "Extracted Palette", 
                        metadata: { palette: analysis.colors, tags: analysis.keywords }
                    } : i
                );
            }
            return copy;
        });

      } catch (e) { 
          alert("Analysis failed"); 
          setHistory(prev => {
            const copy = [...prev];
            if (targetIndex < copy.length) {
                copy[targetIndex] = copy[targetIndex].filter(i => i.id !== placeholderId);
            }
            return copy;
          });
      }
  };

  const handleMatchStyle = async (id: string) => {
      const item = items.find(i => i.id === id);
      if (!item) return;
      const prompt = window.prompt("What should the matching image be?");
      if (!prompt) return;

      const idPlaceholder = generateId();
      const placeholder: CanvasItem = {
          id: idPlaceholder,
          type: ItemType.IMAGE,
          position: { x: item.position.x + item.size.width + 20, y: item.position.y },
          size: { ...item.size },
          content: 'loading',
          zIndex: item.zIndex
      };
      
      pushToHistory([...items, placeholder]);
      const targetIndex = historyIndex + 1;

      try {
         const analysis = await geminiService.analyzeImage(item.content);
         const base64 = await geminiService.generateGenericImage(prompt, referenceImages, "1:1"); // Use simple generation for matching
         
         setHistory(prev => {
             const copy = [...prev];
             if (targetIndex < copy.length) copy[targetIndex] = copy[targetIndex].map(i => i.id === idPlaceholder ? { ...i, content: base64 } : i);
             return copy;
         });
      } catch (e) {
          alert("Match failed.");
      }
  };

  const handleSmartCompose = async (prompt: string) => {
    const selectedImages = items.filter(i => selectedIds.has(i.id) && i.type === ItemType.IMAGE);
    if (selectedImages.length === 0) return;

    const centerX = selectedImages.reduce((sum, i) => sum + i.position.x, 0) / selectedImages.length;
    const centerY = selectedImages.reduce((sum, i) => sum + i.position.y, 0) / selectedImages.length;

    const idPlaceholder = generateId();
    const placeholder: CanvasItem = {
        id: idPlaceholder,
        type: ItemType.IMAGE,
        position: { x: centerX, y: centerY + 300 },
        size: { width: 480, height: 270 },
        content: 'loading',
        zIndex: Math.max(...items.map(i => i.zIndex)) + 1,
    };

    pushToHistory([...items, placeholder]);
    const targetIndex = historyIndex + 1;

    try {
        const refImages = selectedImages.map(i => i.content);
        const resultBase64 = await geminiService.smartCompose(refImages, prompt);
        setHistory(prev => {
            const copy = [...prev];
            if (targetIndex < copy.length) copy[targetIndex] = copy[targetIndex].map(i => i.id === idPlaceholder ? { ...i, content: resultBase64 } : i);
            return copy;
        });
    } catch (e) {
        alert("Smart Compose Failed.");
    }
  };

  const handleStyleTransfer = async (contentId: string, styleId: string) => {
      const contentItem = items.find(i => i.id === contentId);
      const styleItem = items.find(i => i.id === styleId);
      if (!contentItem || !styleItem) return;

      const idPlaceholder = generateId();
      const placeholder: CanvasItem = {
          id: idPlaceholder,
          type: ItemType.IMAGE,
          position: { x: contentItem.position.x + contentItem.size.width + 20, y: contentItem.position.y },
          size: { width: contentItem.size.width, height: contentItem.size.height },
          content: 'loading',
          zIndex: Math.max(...items.map(i => i.zIndex)) + 1,
      };

      pushToHistory([...items, placeholder]);
      const targetIndex = historyIndex + 1;

      try {
          const resultBase64 = await geminiService.applyStyleTransfer(contentItem.content, styleItem.content);
          setHistory(prev => {
             const copy = [...prev];
             if (targetIndex < copy.length) copy[targetIndex] = copy[targetIndex].map(i => i.id === idPlaceholder ? { ...i, content: resultBase64 } : i);
             return copy;
         });
      } catch (e) { alert("Style Transfer Failed."); }
  };


  // --- MOUSE HANDLERS ---
  const handleMouseDown = (e: React.MouseEvent) => {
    // Always allow Pan regardless of generating state
    if (isSpacePressed.current || e.button === 1 || e.button === 2) {
        e.preventDefault();
        dragInfo.current = { mode: 'PAN', startX: e.clientX, startY: e.clientY, initialView: { ...viewState }, initialItemPos: new Map(), targetId: null };
        return;
    }
    // Prevent Selection/Drag if generating
    if (isGenerating) return;

    if (!e.shiftKey) setSelectedIds(new Set());
    dragInfo.current = { mode: 'SELECT_BOX', startX: e.clientX, startY: e.clientY, initialView: { ...viewState }, initialItemPos: new Map(), targetId: null };
    const worldPos = screenToWorld({x: e.clientX, y: e.clientY}, viewState);
    setSelectionBox({ startX: worldPos.x, startY: worldPos.y, currentX: worldPos.x, currentY: worldPos.y });
  };

  const handleItemMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    // Allow Pan over items
    if (isSpacePressed.current || e.button === 1 || e.button === 2) { handleMouseDown(e); return; }
    // Prevent interaction if generating
    if (isGenerating) return;

    let newSelectedIds = new Set(selectedIds);
    const clickedItem = items.find(i => i.id === id);
    if (e.shiftKey) {
        if (newSelectedIds.has(id)) newSelectedIds.delete(id);
        else newSelectedIds.add(id);
        if (clickedItem?.groupId) items.forEach(i => { if (i.groupId === clickedItem.groupId) newSelectedIds.add(i.id); });
    } else {
        if (!selectedIds.has(id)) {
            newSelectedIds.clear();
            newSelectedIds.add(id);
            if (clickedItem?.groupId) items.forEach(i => { if (i.groupId === clickedItem.groupId) newSelectedIds.add(i.id); });
        }
    }
    setSelectedIds(newSelectedIds);
    if (clickedItem?.locked) return;

    const initialPosMap = new Map<string, Point>();
    items.forEach(i => { if (newSelectedIds.has(i.id) && !i.locked) initialPosMap.set(i.id, { ...i.position }); });
    dragInfo.current = { mode: 'DRAG_ITEM', startX: e.clientX, startY: e.clientY, initialView: { ...viewState }, initialItemPos: initialPosMap, targetId: id };
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const info = dragInfo.current;
    if (info.mode === 'PAN') {
      setViewState({ ...info.initialView, x: info.initialView.x + (e.clientX - info.startX), y: info.initialView.y + (e.clientY - info.startY) });
    } 
    else if (info.mode === 'DRAG_ITEM' && !isGenerating) { // Double check generating guard
      const dx = (e.clientX - info.startX) / viewState.scale;
      const dy = (e.clientY - info.startY) / viewState.scale;
      setHistory(prev => {
          const currentItems = [...prev[historyIndex]];
          const updatedItems = currentItems.map(item => {
              if (info.initialItemPos.has(item.id)) {
                  const initial = info.initialItemPos.get(item.id)!;
                  let newX = initial.x + dx;
                  let newY = initial.y + dy;
                  if (snapEnabled) { newX = snapToGrid(newX, GRID_SIZE); newY = snapToGrid(newY, GRID_SIZE); }
                  return { ...item, position: { x: newX, y: newY } };
              }
              return item;
          });
          const newHistory = [...prev];
          newHistory[historyIndex] = updatedItems;
          return newHistory;
      });
    }
    else if (info.mode === 'SELECT_BOX' && !isGenerating) {
        const worldPos = screenToWorld({x: e.clientX, y: e.clientY}, viewState);
        setSelectionBox(prev => prev ? { ...prev, currentX: worldPos.x, currentY: worldPos.y } : null);
    }
  }, [viewState, snapEnabled, historyIndex, isGenerating]);

  const handleMouseUp = useCallback(() => {
    const info = dragInfo.current;
    if (info.mode === 'SELECT_BOX' && selectionBox) {
        const box = { x: Math.min(selectionBox.startX, selectionBox.currentX), y: Math.min(selectionBox.startY, selectionBox.currentY), w: Math.abs(selectionBox.currentX - selectionBox.startX), h: Math.abs(selectionBox.currentY - selectionBox.startY) };
        const newSelection = new Set<string>();
        items.forEach(item => { if (isIntersecting(box, item)) newSelection.add(item.id); });
        setSelectedIds(newSelection);
        setSelectionBox(null);
    }
    dragInfo.current.mode = 'IDLE';
  }, [items, selectionBox, viewState]); 

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);


  // --- RENDER ---

  if (!hasApiKey) {
      return (
          <div className="w-full h-screen bg-gray-950 flex flex-col items-center justify-center text-white relative">
               <div className="bg-gray-900 border border-gray-800 p-8 rounded-2xl shadow-2xl flex flex-col items-center text-center max-w-md w-full mx-4">
                    <Sparkles className="text-purple-400 w-10 h-10 mb-4" />
                    <h1 className="text-3xl font-bold mb-2">Nanoflow Canvas</h1>
                    <p className="text-gray-400 mb-6">AI-Powered Infinite Canvas with Gemini</p>

                    <div className="w-full space-y-4">
                      <input
                        type="password"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmitApiKey()}
                        placeholder="Enter your Gemini API Key"
                        className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                      />
                      <button
                        onClick={handleSubmitApiKey}
                        disabled={!apiKeyInput.trim() || isSubmitting}
                        className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-xl font-medium transition-colors"
                      >
                        {isSubmitting ? 'Connecting...' : 'Start Creating'}
                      </button>
                    </div>

                    <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="mt-6 text-sm text-purple-400 hover:text-purple-300 underline">
                      Get a free API key from Google AI Studio
                    </a>
               </div>
          </div>
      );
  }

  // Workflow Mode - Node-based editor
  if (appMode === 'workflow') {
    return <WorkflowCanvas onBack={() => setAppMode('canvas')} />;
  }

  return (
    <div className="w-full h-screen bg-gray-950 overflow-hidden relative font-sans text-gray-100 select-none flex">

      {/* Mode Toggle Button - Fixed position */}
      {!isPresentationMode && (
        <button
          onClick={() => setAppMode('workflow')}
          className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white rounded-lg shadow-lg transition-all"
        >
          <GitBranch className="w-4 h-4" />
          <span className="text-sm font-medium">Workflow Mode</span>
        </button>
      )}

      {/* LEFT SIDEBAR (Project Workflow) */}
      {!isPresentationMode && (
          <ProjectSidebar 
              projectPlan={projectPlan}
              referenceImages={referenceImages}
              onSetReferences={setReferenceImages}
              onCreateProject={handleCreateProject}
              onGenerateShot={handleGenerateShot}
              onUpdateShot={handleUpdateShot}
              isPlanning={isPlanning}
              isGeneratingShot={isGenerating} // This mainly blocks the project plan creation now
          />
      )}

      {/* CANVAS AREA */}
      <div className="flex-1 relative h-full">
          {!isPresentationMode && (
             <PromptBar 
                onGenerateBoard={handleGenerateQuickBoard}
                onGenerateImage={handleGenerateGenericImage}
                isGenerating={isGenerating}
             />
          )}

          <div 
            ref={containerRef}
            className={`w-full h-full bg-grid-pattern relative touch-none outline-none ${isGenerating ? 'cursor-wait' : ''}`}
            onMouseDown={handleMouseDown}
            onWheel={(e) => {
                e.preventDefault();
                if(e.ctrlKey) {
                    const scaleAmount = -e.deltaY * 0.002;
                    const newScale = Math.min(Math.max(viewState.scale * (1 + scaleAmount), MIN_SCALE), MAX_SCALE);
                    setViewState({ ...viewState, scale: newScale });
                } else {
                    setViewState(prev => ({ ...prev, x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
                }
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDraggingFile(true); }}
            onDragLeave={(e) => { e.preventDefault(); setIsDraggingFile(false); }}
            onDrop={(e) => { 
                e.preventDefault(); setIsDraggingFile(false); 
                if(e.dataTransfer.files.length) handleBatchUpload(Array.from(e.dataTransfer.files), { x: e.clientX, y: e.clientY }); 
            }}
            onContextMenu={(e) => e.preventDefault()}
          >
            <div className="absolute origin-top-left will-change-transform" style={{ transform: `translate(${viewState.x}px, ${viewState.y}px) scale(${viewState.scale})` }}>
              {items.map(item => (
                <CanvasItemComponent
                  key={item.id}
                  item={item}
                  isSelected={selectedIds.has(item.id)}
                  onMouseDown={handleItemMouseDown}
                  onSelect={(id) => {}}
                  onDelete={handleDelete}
                  onDuplicate={handleDuplicate}
                  onGenerateVariation={handleGenerateVariation}
                  onToggleLock={handleToggleLock}
                  onBringToFront={handleBringToFront}
                  onSendToBack={handleSendToBack}
                  onDownload={handleDownloadItem}
                  onUpscale={handleUpscale}
                />
              ))}
              {selectionBox && (
                  <div className="absolute border border-blue-500 bg-blue-500/20 pointer-events-none z-[100]"
                    style={{
                        left: Math.min(selectionBox.startX, selectionBox.currentX),
                        top: Math.min(selectionBox.startY, selectionBox.currentY),
                        width: Math.abs(selectionBox.currentX - selectionBox.startX),
                        height: Math.abs(selectionBox.currentY - selectionBox.startY)
                    }}
                  />
              )}
            </div>
            {isDraggingFile && <div className="absolute inset-0 bg-blue-500/10 z-50 flex items-center justify-center border-4 border-blue-500 border-dashed m-4 rounded-xl text-blue-300 font-bold text-xl">Drop Image</div>}
          </div>

          {!isPresentationMode && (
              <>
                <Toolbar 
                    onAddText={handleAddText} 
                    onAddNote={handleAddNote}
                    onUpload={(files) => handleBatchUpload(files)}
                    onZoomIn={() => setViewState(v => ({...v, scale: Math.min(v.scale * 1.2, MAX_SCALE)}))}
                    onZoomOut={() => setViewState(v => ({...v, scale: Math.max(v.scale * 0.8, MIN_SCALE)}))}
                    onExport={() => {}}
                    onUndo={handleUndo}
                    onRedo={handleRedo}
                    canUndo={historyIndex > 0 && !isGenerating}
                    canRedo={historyIndex < history.length - 1 && !isGenerating}
                    snapEnabled={snapEnabled}
                    onToggleSnap={() => setSnapEnabled(!snapEnabled)}
                    onGroup={handleGroup}
                    onUngroup={handleUngroup}
                    hasSelection={selectedIds.size > 0}
                    onSave={handleSave}
                    onLoad={handleLoad}
                    isPresentationMode={isPresentationMode}
                    onTogglePresentation={() => setIsPresentationMode(true)}
                />
                <PropertiesPanel 
                    selectedItems={items.filter(i => selectedIds.has(i.id))} 
                    onExtractPalette={handleExtractPalette}
                    onMatchStyle={handleMatchStyle}
                    onMultiGenerate={handleSmartCompose}
                    onSetRole={() => {}} // Deprecated but kept for type safety
                    onSynthesizeShot={() => {}} // Deprecated
                    onStyleTransfer={handleStyleTransfer}
                    onSynthesizeSmart={handleSmartCompose}
                    onAddToContext={handleAddToContext}
                />
              </>
          )}
          
          {isPresentationMode && (
              <div className="fixed top-4 right-4 bg-black/50 backdrop-blur text-white px-4 py-2 rounded-full text-xs pointer-events-none">
                  Presentation Mode
              </div>
          )}
      </div>
    </div>
  );
};

export default App;
