
import React, { useState, useRef } from 'react';
import { Sparkles, Image as ImageIcon, LayoutDashboard, Paperclip, X, Ratio, Monitor, Smartphone, Square, RectangleHorizontal, RectangleVertical, Scaling } from 'lucide-react';

interface Props {
  onGenerateBoard: (prompt: string, images: string[], aspectRatio: string) => void;
  onGenerateImage: (prompt: string, images: string[], aspectRatio: string, imageSize: "1K"|"2K"|"4K") => void;
  isGenerating: boolean;
}

const ASPECT_RATIOS = [
    { label: "1:1", value: "1:1", icon: Square },
    { label: "16:9", value: "16:9", icon: Monitor }, // Swapped
    { label: "9:16", value: "9:16", icon: Smartphone },
    { label: "4:3", value: "4:3", icon: RectangleHorizontal }, // Swapped
    { label: "3:4", value: "3:4", icon: RectangleVertical },
];

const PromptBar: React.FC<Props> = ({ onGenerateBoard, onGenerateImage, isGenerating }) => {
  const [prompt, setPrompt] = useState('');
  const [attachedImages, setAttachedImages] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState<"1K"|"2K"|"4K">("2K");
  const [showRatioMenu, setShowRatioMenu] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files) as File[];
      const remainingSlots = 8 - attachedImages.length;
      const filesToProcess = files.slice(0, remainingSlots);

      filesToProcess.forEach(file => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (ev.target?.result) {
            setAttachedImages(prev => [...prev, ev.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      });
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if ((prompt.trim() || attachedImages.length > 0) && !isGenerating) {
            onGenerateBoard(prompt, attachedImages, aspectRatio);
        }
    }
  };

  const CurrentRatioIcon = ASPECT_RATIOS.find(r => r.value === aspectRatio)?.icon || Square;

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50">
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-200"></div>
        <div className="relative flex flex-col bg-gray-900 border border-gray-700/50 rounded-2xl shadow-2xl overflow-visible">
          
          {/* Main Input Area */}
          <div className="flex items-center p-1.5 pl-4 gap-2">
            <Sparkles className={`w-5 h-5 mr-1 flex-shrink-0 ${isGenerating ? 'text-blue-400 animate-pulse' : 'text-gray-400'}`} />
            
            <div className="flex-1 flex flex-wrap items-center gap-2 min-w-0">
                {/* Image Chips */}
                {attachedImages.map((img, idx) => (
                    <div key={idx} className="relative group/chip flex-shrink-0">
                        <img src={img} alt="ref" className="w-10 h-10 rounded-md object-cover border border-gray-600" />
                        <button 
                            onClick={() => removeImage(idx)}
                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover/chip:opacity-100 transition-opacity"
                        >
                            <X size={8} />
                        </button>
                    </div>
                ))}

                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={attachedImages.length > 0 ? "Add instructions for these references..." : "Describe a mood board or image..."}
                    className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-500 text-sm md:text-base py-2 min-w-[200px]"
                    disabled={isGenerating}
                />
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1 pl-2">
                {/* Ratio/Size Selector */}
                <div className="relative">
                    <button
                        onClick={() => setShowRatioMenu(!showRatioMenu)}
                        className="p-2 text-gray-400 hover:bg-gray-800 hover:text-white rounded-lg transition-colors flex items-center gap-1"
                        title="Settings"
                    >
                        <CurrentRatioIcon size={18} />
                        <span className="text-xs font-medium w-6">{aspectRatio}</span>
                    </button>
                    {showRatioMenu && (
                        <div className="absolute top-full right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-xl p-2 z-50 w-40 flex flex-col gap-2">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 pl-2">Ratio</span>
                                {ASPECT_RATIOS.map(ratio => (
                                    <button
                                        key={ratio.value}
                                        onClick={() => { setAspectRatio(ratio.value); }}
                                        className={`flex items-center gap-2 p-2 rounded-lg text-xs ${aspectRatio === ratio.value ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                    >
                                        <ratio.icon size={14} />
                                        {ratio.label}
                                    </button>
                                ))}
                            </div>
                            <div className="h-px bg-gray-700"></div>
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] uppercase font-bold text-gray-500 pl-2">Quality</span>
                                {(["1K", "2K", "4K"] as const).map(size => (
                                     <button
                                        key={size}
                                        onClick={() => setImageSize(size)}
                                        className={`flex items-center gap-2 p-2 rounded-lg text-xs ${imageSize === size ? 'bg-purple-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}
                                    >
                                        <Scaling size={14} />
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="w-px h-6 bg-gray-700 mx-1"></div>

                <input 
                    type="file" 
                    multiple 
                    accept="image/*" 
                    className="hidden" 
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isGenerating || attachedImages.length >= 8}
                    className={`p-2 rounded-lg transition-colors flex items-center justify-center ${attachedImages.length >= 8 ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:bg-gray-800 hover:text-white'}`}
                    title="Attach Reference Images (Max 8)"
                >
                    <Paperclip size={18} />
                </button>

                <div className="w-px h-6 bg-gray-700 mx-1"></div>

                <button
                    onClick={() => (prompt.trim() || attachedImages.length > 0) && !isGenerating && onGenerateImage(prompt, attachedImages, aspectRatio, imageSize)}
                    disabled={isGenerating || (!prompt.trim() && attachedImages.length === 0)}
                    className="p-2 hover:bg-gray-800 text-gray-400 hover:text-blue-400 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium"
                    title="Generate Single Image"
                >
                    <ImageIcon size={18} />
                    <span className="hidden sm:inline">Image</span>
                </button>
                
                <button
                    onClick={() => (prompt.trim() || attachedImages.length > 0) && !isGenerating && onGenerateBoard(prompt, attachedImages, aspectRatio)}
                    disabled={isGenerating || (!prompt.trim() && attachedImages.length === 0)}
                    className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-xl transition-colors flex items-center gap-2 text-xs font-medium border border-gray-700"
                    title="Generate Full Mood Board"
                >
                    <LayoutDashboard size={18} />
                    <span className="hidden sm:inline">Board</span>
                </button>
            </div>
          </div>
          
          {attachedImages.length > 0 && (
              <div className="h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 w-full animate-in fade-in slide-in-from-top-1"></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromptBar;
