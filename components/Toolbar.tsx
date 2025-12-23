
import React, { useRef } from 'react';
import { 
  Image as ImageIcon, Type, Palette, Upload, Download, Share2, 
  ZoomIn, ZoomOut, MousePointer2, Grid3X3, Undo2, Redo2, 
  Group, Ungroup, Save, FolderOpen, StickyNote, Play
} from 'lucide-react';

interface Props {
  onAddText: () => void;
  onAddNote: () => void;
  onUpload: (files: File[]) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onExport: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  snapEnabled: boolean;
  onToggleSnap: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  hasSelection: boolean;
  onSave: () => void;
  onLoad: (file: File) => void;
  isPresentationMode: boolean;
  onTogglePresentation: () => void;
}

const Toolbar: React.FC<Props> = ({ 
  onAddText, onAddNote, onUpload, onZoomIn, onZoomOut, onExport,
  onUndo, onRedo, canUndo, canRedo,
  snapEnabled, onToggleSnap,
  onGroup, onUngroup, hasSelection,
  onSave, onLoad,
  isPresentationMode, onTogglePresentation
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const loadInputRef = useRef<HTMLInputElement>(null);

  if (isPresentationMode) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onUpload(Array.from(e.target.files));
    }
    // Reset to allow same file upload again
    if (e.target) e.target.value = '';
  };

  const handleLoadFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onLoad(e.target.files[0]);
    }
    if (e.target) e.target.value = '';
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800/95 backdrop-blur-md border border-gray-700/50 rounded-2xl shadow-2xl p-2 flex items-center gap-2 z-50">
      
      {/* Undo/Redo */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-700">
         <button onClick={onUndo} disabled={!canUndo} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 rounded-xl transition-colors" title="Undo (Ctrl+Z)">
            <Undo2 size={18} />
         </button>
         <button onClick={onRedo} disabled={!canRedo} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 rounded-xl transition-colors" title="Redo (Ctrl+Y)">
            <Redo2 size={18} />
         </button>
      </div>

      {/* Tools */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-700">
        <label className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl cursor-pointer transition-colors" title="Upload Image">
            <input type="file" multiple accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
            <Upload size={20} />
        </label>
        
        <button onClick={onAddText} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors" title="Add Text">
            <Type size={20} />
        </button>

        <button onClick={onAddNote} className="p-2.5 text-yellow-500 hover:text-yellow-300 hover:bg-gray-700 rounded-xl transition-colors" title="Add Sticky Note">
            <StickyNote size={20} />
        </button>

        <button 
            onClick={onToggleSnap} 
            className={`p-2.5 rounded-xl transition-colors ${snapEnabled ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`} 
            title="Snap to Grid"
        >
            <Grid3X3 size={20} />
        </button>
      </div>

      {/* Grouping */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-700">
         <button onClick={onGroup} disabled={!hasSelection} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 rounded-xl transition-colors" title="Group Selected">
            <Group size={20} />
         </button>
         <button onClick={onUngroup} disabled={!hasSelection} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 disabled:opacity-30 rounded-xl transition-colors" title="Ungroup">
            <Ungroup size={20} />
         </button>
      </div>

      {/* View */}
      <div className="flex items-center gap-1 px-2 border-r border-gray-700">
        <button onClick={onZoomOut} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors">
            <ZoomOut size={18} />
        </button>
        <button onClick={onZoomIn} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors">
            <ZoomIn size={18} />
        </button>
      </div>

      {/* File Operations */}
       <div className="flex items-center gap-1 px-2">
        <button onClick={onSave} className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors" title="Save Project">
            <Save size={20} />
        </button>
        <label className="p-2.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl cursor-pointer transition-colors" title="Load Project">
            <input type="file" accept=".json" className="hidden" ref={loadInputRef} onChange={handleLoadFile} />
            <FolderOpen size={20} />
        </label>
        <button onClick={onTogglePresentation} className="p-2.5 text-purple-400 hover:text-purple-300 hover:bg-gray-700 rounded-xl transition-colors" title="Presentation Mode">
            <Play size={20} />
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
