
import React, { memo } from 'react';
import { CanvasItem as ICanvasItem, ItemType, CompositionRole } from '../types';
import { Loader2, Sparkles, Trash2, Copy, Lock, Unlock, BringToFront, SendToBack, Download, Maximize2 } from 'lucide-react';

interface Props {
  item: ICanvasItem;
  isSelected: boolean;
  onMouseDown: (e: React.MouseEvent, id: string) => void;
  onSelect: (id: string, multi: boolean) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onGenerateVariation: (id: string, prompt: string) => void;
  onToggleLock: (id: string) => void;
  onBringToFront: (id: string) => void;
  onSendToBack: (id: string) => void;
  onDownload: (item: ICanvasItem) => void;
  onUpscale?: (id: string) => void;
}

const CanvasItemComponent: React.FC<Props> = ({ 
  item, 
  isSelected, 
  onMouseDown, 
  onSelect, 
  onDelete, 
  onDuplicate,
  onGenerateVariation,
  onToggleLock,
  onBringToFront,
  onSendToBack,
  onDownload,
  onUpscale
}) => {
  
  const handleInteraction = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item.id, e.shiftKey);
    onMouseDown(e, item.id);
  };

  const isLocked = item.locked;
  const isLoading = item.content === 'loading';

  return (
    <div
      className={`absolute group touch-none select-none transition-all duration-200
        ${isSelected ? 'z-50' : 'hover:z-40'}
        ${isSelected && !isLocked ? 'ring-2 shadow-xl ring-blue-500' : ''}
        ${!isSelected ? 'border-2 border-transparent' : ''}
        ${isSelected && isLocked ? 'ring-2 ring-red-500/50 shadow-none' : ''}
        ${!isSelected && !isLocked ? 'hover:ring-1 hover:ring-white/30 hover:shadow-lg' : ''}
        ${item.type === ItemType.TEXT ? 'bg-transparent' : ''}
        ${item.type === ItemType.IMAGE ? 'bg-gray-800 rounded-lg overflow-hidden' : ''}
        ${item.type === ItemType.NOTE ? 'bg-yellow-200 text-gray-900 rounded-sm shadow-md' : ''}
        ${item.groupId && !isSelected ? 'ring-1 ring-white/10 ring-dashed' : ''} 
      `}
      style={{
        left: item.position.x,
        top: item.position.y,
        width: item.size.width,
        height: item.type === ItemType.TEXT ? 'auto' : item.size.height,
        transform: 'translate(-50%, -50%)', // Center origin
        zIndex: item.zIndex,
        cursor: isLocked ? 'not-allowed' : 'move'
      }}
      onMouseDown={handleInteraction}
    >
      {/* Content */}
      <div className="w-full h-full relative overflow-hidden group">
        {item.type === ItemType.IMAGE && (
          <img 
            src={isLoading ? undefined : item.content} 
            alt="Asset" 
            className={`w-full h-full object-cover pointer-events-none ${isLocked ? 'opacity-90 grayscale-[0.2]' : ''}`} 
            draggable={false}
            decoding="async"
          />
        )}
        
        {item.type === ItemType.TEXT && (
          <div className="p-4 text-white font-bold text-3xl drop-shadow-md text-center min-w-[200px]">
            {item.content}
          </div>
        )}

        {item.type === ItemType.NOTE && (
          <div className="p-4 w-full h-full font-serif text-lg leading-snug flex items-center justify-center text-center overflow-hidden break-words whitespace-pre-wrap bg-yellow-100">
             {item.content}
          </div>
        )}

        {item.type === ItemType.PALETTE && (
            <div className="flex flex-col h-full w-full bg-gray-900 p-2">
                {isLoading ? (
                    <div className="flex-1 flex items-center justify-center text-xs text-gray-500 gap-2">
                        <Loader2 className="animate-spin" size={14} /> Extracting...
                    </div>
                ) : (
                    <>
                        <div className="flex-1 flex w-full gap-1">
                            {item.metadata?.palette?.map((color, i) => (
                                <div key={i} className="h-full flex-1 rounded-sm" style={{ backgroundColor: color }} title={color}></div>
                            ))}
                        </div>
                        <div className="text-xs text-gray-400 mt-2 font-mono text-center truncate">
                            {item.content}
                        </div>
                    </>
                )}
            </div>
        )}

        {/* Loading Overlay */}
        {isLoading && (
             <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-800/80 backdrop-blur-sm animate-pulse">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
                <span className="text-xs text-gray-400 font-mono">Generating...</span>
             </div>
        )}

        {/* Persistent Download Button (Visible on Hover) */}
        {item.type === ItemType.IMAGE && !isLoading && (
            <button 
                onClick={(e) => { 
                    e.stopPropagation(); 
                    onDownload(item); 
                }} 
                className="absolute top-2 right-2 p-2 bg-black/60 hover:bg-blue-600 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all z-30 backdrop-blur-sm transform scale-90 group-hover:scale-100 shadow-lg border border-white/10"
                title="Download Image"
            >
                <Download size={16} />
            </button>
        )}

        {/* Status Indicators */}
        {item.groupId && isSelected && (
            <div className="absolute -top-6 left-0 bg-blue-500/20 text-blue-300 text-[10px] px-2 py-0.5 rounded-t font-mono">
                GROUPED
            </div>
        )}
        {isLocked && (
            <div className="absolute top-2 left-2 text-red-500/70 bg-white/50 rounded-full p-1 z-30">
                <Lock size={12} />
            </div>
        )}

        {/* Role Badges */}
        {item.metadata?.role && item.metadata.role !== CompositionRole.NONE && (
            <div className={`absolute top-2 left-2 px-2 py-1 rounded text-[9px] font-bold tracking-wider shadow-sm z-20 border
                ${item.metadata.role === CompositionRole.BLOCKING ? 'bg-blue-500/90 text-white border-blue-400' : ''}
                ${item.metadata.role === CompositionRole.CHARACTER ? 'bg-green-500/90 text-white border-green-400' : ''}
                ${item.metadata.role === CompositionRole.BACKGROUND ? 'bg-purple-500/90 text-white border-purple-400' : ''}
            `}>
                {item.metadata.role === CompositionRole.BLOCKING && 'LAYOUT'}
                {item.metadata.role === CompositionRole.CHARACTER && 'CHAR'}
                {item.metadata.role === CompositionRole.BACKGROUND && 'STYLE'}
            </div>
        )}

        {/* Hover Controls (Only visible when selected) */}
        {(isSelected && !isLoading) && (
          <div className="absolute -top-14 left-1/2 -translate-x-1/2 flex flex-col items-center z-[60]">
             
             {/* Main Toolbar */}
             <div className="flex items-center gap-1 bg-gray-900/90 backdrop-blur-sm p-1.5 rounded-full border border-gray-700 shadow-xl opacity-100 transition-opacity">
                
                {/* Lock Toggle */}
                <button onClick={(e) => { e.stopPropagation(); onToggleLock(item.id); }} className={`p-1.5 rounded-full ${isLocked ? 'bg-red-500 text-white' : 'hover:bg-white/10 text-gray-300'}`} title={isLocked ? "Unlock" : "Lock"}>
                  {isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                </button>

                <div className="w-px h-4 bg-gray-700 mx-1"></div>

                {!isLocked && (
                    <>
                    <button onClick={(e) => { e.stopPropagation(); onBringToFront(item.id); }} className="p-1.5 hover:bg-white/10 text-white rounded-full" title="Bring to Front">
                        <BringToFront size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onSendToBack(item.id); }} className="p-1.5 hover:bg-white/10 text-white rounded-full" title="Send to Back">
                        <SendToBack size={14} />
                    </button>
                    <div className="w-px h-4 bg-gray-700 mx-1"></div>
                    
                    <button onClick={(e) => { e.stopPropagation(); onDuplicate(item.id); }} className="p-1.5 hover:bg-white/10 text-white rounded-full" title="Duplicate">
                        <Copy size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} className="p-1.5 hover:bg-red-500/20 text-red-400 rounded-full" title="Delete">
                        <Trash2 size={14} />
                    </button>
                    </>
                )}
                 
                {/* Image Specific Actions */}
                {item.type === ItemType.IMAGE && !isLocked && (
                     <>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        <button onClick={(e) => { e.stopPropagation(); onDownload(item); }} className="p-1.5 hover:bg-blue-600/30 text-blue-300 rounded-full" title="Download">
                            <Download size={14} />
                        </button>
                        {onUpscale && (
                            <button onClick={(e) => { e.stopPropagation(); onUpscale(item.id); }} className="p-1.5 hover:bg-purple-600/30 text-purple-300 rounded-full" title="Upscale to 4K">
                                <Maximize2 size={14} />
                            </button>
                        )}
                     </>
                )}
             </div>

             {/* Variation Sub-bar (Only for images and unlocked) */}
             {item.type === ItemType.IMAGE && !isLocked && (
                <div className="mt-1">
                    <button 
                        onClick={(e) => { 
                            e.stopPropagation(); 
                            const p = prompt("Enter a variation prompt (e.g., 'make it darker')");
                            if(p) onGenerateVariation(item.id, p);
                        }} 
                        className="px-3 py-1 bg-blue-600/90 hover:bg-blue-600 text-white rounded-full flex items-center gap-1 shadow-lg backdrop-blur-sm border border-blue-500/50" 
                        title="Generate Variation"
                    >
                        <Sparkles size={12} />
                        <span className="text-[10px] font-bold uppercase tracking-wide">Remix</span>
                    </button>
                </div>
             )}
          </div>
        )}
      </div>

       {/* Resize Handle */}
       {isSelected && !isLocked && item.type !== ItemType.TEXT && (
        <div className="absolute bottom-0 right-0 w-4 h-4 bg-blue-500 cursor-nwse-resize rounded-tl-lg" />
       )}
    </div>
  );
};

export default memo(CanvasItemComponent);
