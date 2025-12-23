
import React from 'react';
import { CanvasItem, ItemType, CompositionRole } from '../types';
import { Wand2, Palette, Layers, Sparkles, Blend, Clapperboard, Video, User, Grid, X, PaintBucket, ArrowRightLeft, Upload, LayoutTemplate, Check, MousePointerClick } from 'lucide-react';

interface Props {
  selectedItems: CanvasItem[]; 
  onExtractPalette: (id: string) => void;
  onMatchStyle: (id: string) => void;
  onMultiGenerate: (prompt: string) => void;
  onSetRole: (id: string, role: CompositionRole, desc?: string) => void;
  onSynthesizeShot: () => void;
  onStyleTransfer: (contentId: string, styleId: string) => void;
  onSynthesizeSmart?: (prompt: string) => void;
  onAddToContext?: (id: string) => void;
}

const RoleCard: React.FC<{
    icon: React.ElementType;
    label: string;
    sub: string;
    active: boolean;
    color: string;
    onClick: () => void;
}> = ({ icon: Icon, label, sub, active, color, onClick }) => (
    <button 
        onClick={onClick}
        className={`relative w-full p-3 rounded-xl border-2 transition-all duration-200 text-left group
            ${active 
                ? `bg-${color}-500/10 border-${color}-500 shadow-[0_0_15px_-3px_rgba(var(--${color}-500-rgb),0.3)]` 
                : 'bg-gray-800 border-gray-700 hover:border-gray-600 hover:bg-gray-750'
            }
        `}
    >
        <div className="flex items-start gap-3">
            <div className={`p-2.5 rounded-lg transition-colors ${active ? `bg-${color}-500 text-white` : 'bg-gray-700 text-gray-400 group-hover:bg-gray-600'}`}>
                <Icon size={18} />
            </div>
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center">
                    <span className={`font-bold text-sm ${active ? `text-${color}-200` : 'text-gray-200'}`}>{label}</span>
                    {active && <Check size={16} className={`text-${color}-400`} />}
                </div>
                <span className={`text-[11px] leading-tight block mt-0.5 ${active ? `text-${color}-300/80` : 'text-gray-500'}`}>{sub}</span>
            </div>
        </div>
    </button>
);

const PropertiesPanel: React.FC<Props> = ({ 
    selectedItems, 
    onExtractPalette, 
    onMatchStyle, 
    onMultiGenerate,
    onSetRole,
    onSynthesizeShot,
    onStyleTransfer,
    onSynthesizeSmart,
    onAddToContext
}) => {
  if (!selectedItems || selectedItems.length === 0) return null;

  const isMultiSelect = selectedItems.length > 1;
  const imageCount = selectedItems.filter(i => i.type === ItemType.IMAGE).length;
  const firstItem = selectedItems[0];
  const activeRoles = selectedItems.some(i => i.metadata?.role && i.metadata.role !== CompositionRole.NONE);

  return (
    <div className="fixed top-24 right-6 w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl p-5 z-40 animate-in slide-in-from-right-10 fade-in duration-300 max-h-[85vh] overflow-y-auto custom-scrollbar">
      
      {/* Header */}
      <div className="mb-5 flex items-center gap-2 pb-4 border-b border-gray-800">
        <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center border border-gray-700">
            {isMultiSelect ? <Layers size={16} className="text-blue-400"/> : <MousePointerClick size={16} className="text-blue-400"/>}
        </div>
        <div>
            <h3 className="text-sm font-bold text-gray-200">
                {isMultiSelect ? 'Selection' : 'Item Properties'}
            </h3>
            <p className="text-[10px] text-gray-500 font-mono">
                {isMultiSelect ? `${selectedItems.length} items` : firstItem.id.slice(-8)}
            </p>
        </div>
      </div>

      {/* MULTI-SELECT SMART ACTION */}
      {isMultiSelect && imageCount > 1 && (
        <div className="mb-6 space-y-3 pb-6 border-b border-gray-800">
             <div className="flex items-center gap-2 mb-1">
                <Sparkles size={16} className="text-amber-400"/>
                <h4 className="text-sm font-semibold text-gray-200">Smart Merge</h4>
             </div>
             <p className="text-xs text-gray-400">
                Combine these {imageCount} images into a single cohesive scene.
             </p>
             <button 
                onClick={() => {
                    const prompt = window.prompt("Describe the scene (e.g. 'Walking together in Tokyo'):");
                    if (prompt && onSynthesizeSmart) onSynthesizeSmart(prompt);
                    else if (prompt) onMultiGenerate(prompt);
                }}
                className="w-full py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 transform hover:scale-[1.02]"
             >
                <Blend size={16} />
                Combine into Scene
             </button>
        </div>
      )}

      {/* STYLE TRANSFER */}
      {selectedItems.length === 2 && imageCount === 2 && (
          <div className="mb-6 space-y-3 pb-6 border-b border-gray-800">
             <div className="flex items-center gap-2 mb-1">
                <PaintBucket size={16} className="text-pink-400"/>
                <h4 className="text-sm font-semibold text-gray-200">Style Transfer</h4>
             </div>
             
             <div className="flex items-center justify-between gap-2 p-3 bg-black/40 rounded-xl border border-gray-800">
                 <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-700">
                    <img src={selectedItems[0].content} className="w-full h-full object-cover" alt="A"/>
                 </div>
                 <ArrowRightLeft size={16} className="text-gray-600"/>
                 <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-gray-700">
                    <img src={selectedItems[1].content} className="w-full h-full object-cover" alt="B"/>
                 </div>
             </div>

             <div className="flex gap-2">
                <button 
                    onClick={() => onStyleTransfer(selectedItems[0].id, selectedItems[1].id)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                >
                    Apply Right to Left
                </button>
                <button 
                    onClick={() => onStyleTransfer(selectedItems[1].id, selectedItems[0].id)}
                    className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-xs text-gray-300 transition-colors"
                >
                    Apply Left to Right
                </button>
             </div>
          </div>
      )}

      {/* COMPOSITION BUILDER (Improved) */}
      {imageCount > 0 && (
          <div className="mb-6 space-y-4 pb-6 border-b border-gray-800">
             <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <LayoutTemplate size={16} className="text-indigo-400"/>
                    <h4 className="text-sm font-semibold text-gray-200">Composition Builder</h4>
                </div>
                {activeRoles && (
                     <button 
                        onClick={() => selectedItems.forEach(i => onSetRole(i.id, CompositionRole.NONE))}
                        className="text-[10px] text-red-400 hover:text-red-300 hover:underline flex items-center gap-1"
                    >
                        <X size={10} /> Clear All
                    </button>
                )}
             </div>
             
             <div className="text-[11px] text-gray-500 bg-gray-800/50 p-3 rounded-lg border border-gray-800/50">
                Tag images to define their role in the next generation.
             </div>

             <div className="space-y-2">
                {/* Layout / Blocking */}
                <RoleCard 
                    icon={Grid}
                    label="Structure Ref"
                    sub="Use this layout & positioning"
                    active={firstItem.metadata?.role === CompositionRole.BLOCKING}
                    color="blue"
                    onClick={() => onSetRole(firstItem.id, firstItem.metadata?.role === CompositionRole.BLOCKING ? CompositionRole.NONE : CompositionRole.BLOCKING)}
                />

                {/* Character */}
                <RoleCard 
                    icon={User}
                    label="Character Ref"
                    sub="Keep identity & face"
                    active={firstItem.metadata?.role === CompositionRole.CHARACTER}
                    color="green"
                    onClick={() => {
                        if (firstItem.metadata?.role === CompositionRole.CHARACTER) {
                            onSetRole(firstItem.id, CompositionRole.NONE);
                        } else {
                            const desc = window.prompt("Who is this? (e.g. 'Hero')");
                            if(desc) onSetRole(firstItem.id, CompositionRole.CHARACTER, desc);
                        }
                    }}
                />

                {/* Style */}
                <RoleCard 
                    icon={Video}
                    label="Style Ref"
                    sub="Copy lighting & mood"
                    active={firstItem.metadata?.role === CompositionRole.BACKGROUND}
                    color="purple"
                    onClick={() => onSetRole(firstItem.id, firstItem.metadata?.role === CompositionRole.BACKGROUND ? CompositionRole.NONE : CompositionRole.BACKGROUND)}
                />
             </div>
             
             {/* Generate Button (Only appears when active) */}
             {activeRoles && (
                <div className="pt-2 animate-in fade-in slide-in-from-bottom-2">
                    <button 
                        onClick={onSynthesizeShot}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-2 ring-1 ring-white/10"
                    >
                        <Clapperboard size={16} />
                        Generate Composite Shot
                    </button>
                    <p className="text-[10px] text-center text-indigo-300/60 mt-2">
                        Uses tagged images as inputs for a new shot.
                    </p>
                </div>
             )}
          </div>
      )}


      {/* AI TOOLS */}
      {!isMultiSelect && firstItem.type === ItemType.IMAGE && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Wand2 size={16} className="text-purple-400"/>
            <h4 className="text-sm font-semibold text-gray-200">Tools</h4>
          </div>
          
          <button 
            onClick={() => onExtractPalette(firstItem.id)}
            className="w-full text-left px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-3 group"
          >
            <Palette size={16} className="text-gray-500 group-hover:text-purple-400 transition-colors"/>
            <span>Extract Palette & Tags</span>
          </button>

          <button 
             onClick={() => onMatchStyle(firstItem.id)}
             className="w-full text-left px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-3 group"
          >
            <Layers size={16} className="text-gray-500 group-hover:text-purple-400 transition-colors"/>
            <span>Generate Matching Asset</span>
          </button>

          {onAddToContext && (
             <button 
                onClick={() => onAddToContext(firstItem.id)}
                className="w-full text-left px-3 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-300 transition-colors flex items-center gap-3 group"
             >
                <Upload size={16} className="text-gray-500 group-hover:text-blue-400 transition-colors"/>
                <span>Add to Project Refs</span>
             </button>
          )}
        </div>
      )}

      {/* METADATA */}
      {!isMultiSelect && firstItem.metadata && (
        <div className="mt-8 pt-6 border-t border-gray-800">
             <h4 className="text-[10px] uppercase font-bold text-gray-500 mb-3 tracking-wider">Metadata</h4>
             
             {firstItem.metadata.description && (
                <div className="text-xs text-gray-400 bg-black/20 p-3 rounded-lg leading-relaxed mb-3">
                    {firstItem.metadata.description}
                </div>
             )}
             
             {firstItem.metadata.tags && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                    {firstItem.metadata.tags.map(tag => (
                        <span key={tag} className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded-md border border-gray-700">
                            #{tag}
                        </span>
                    ))}
                </div>
             )}

            {firstItem.metadata.palette && (
                <div className="flex gap-1.5">
                    {firstItem.metadata.palette.map((c, i) => (
                        <div key={i} className="w-8 h-8 rounded-lg border border-white/10 shadow-sm" style={{background: c}} title={c} />
                    ))}
                </div>
            )}
        </div>
      )}
    </div>
  );
};

export default PropertiesPanel;
