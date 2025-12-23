
import React, { useState, useRef } from 'react';
import { ProjectPlan, ShotConcept } from '../types';
import { Loader2, Sparkles, Image as ImageIcon, ArrowRight, Upload, X, Check, Camera, Layers, Palette, Monitor, Smartphone, Square, RectangleHorizontal, RectangleVertical, Scaling, Plus } from 'lucide-react';

interface Props {
  projectPlan: ProjectPlan | null;
  referenceImages: string[];
  onSetReferences: (images: string[]) => void;
  onCreateProject: (brief: string) => void;
  onGenerateShot: (shot: ShotConcept, aspectRatio: string, imageSize: "1K"|"2K"|"4K"|"1080p", index: number) => void;
  onUpdateShot: (id: string, newDesc: string) => void;
  isPlanning: boolean;
  isGeneratingShot: boolean;
}

const ASPECT_RATIOS = [
    { label: "1:1", value: "1:1", icon: Square },
    { label: "16:9", value: "16:9", icon: Monitor }, // Swapped to Monitor
    { label: "9:16", value: "9:16", icon: Smartphone },
    { label: "4:3", value: "4:3", icon: RectangleHorizontal }, // Swapped to RectangleHorizontal
    { label: "3:4", value: "3:4", icon: RectangleVertical },
];

const RESOLUTIONS = ["1080p", "1K", "2K", "4K"] as const;

const SHOT_VARIATIONS = [
    { label: "Wide Shot", suffix: ", wide shot, establishing scene" },
    { label: "Close-up", suffix: ", close-up shot, detailed facial features" },
    { label: "Portrait", suffix: ", portrait shot, 50mm lens, bokeh" },
    { label: "Macro", suffix: ", macro photography, extreme detail" },
    { label: "Cinematic", suffix: ", cinematic lighting, dramatic angle" }
];

const ProjectSidebar: React.FC<Props> = ({ 
    projectPlan, 
    referenceImages, 
    onSetReferences, 
    onCreateProject,
    onGenerateShot,
    onUpdateShot,
    isPlanning,
    isGeneratingShot
}) => {
    const [brief, setBrief] = useState('');
    const [aspectRatio, setAspectRatio] = useState("1:1");
    const [imageSize, setImageSize] = useState<"1K"|"2K"|"4K"|"1080p">("2K");
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files) as File[];
            const remaining = 5 - referenceImages.length;
            const processedImages: string[] = [];

            for (const file of files.slice(0, remaining)) {
                const result = await new Promise<string>((resolve) => {
                    const reader = new FileReader();
                    reader.onload = (ev) => resolve(ev.target?.result as string || '');
                    reader.readAsDataURL(file);
                });
                if (result) processedImages.push(result);
            }

            if (processedImages.length > 0) {
                onSetReferences([...referenceImages, ...processedImages]);
            }

            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleRemoveImage = (index: number) => {
        const newRefs = [...referenceImages];
        newRefs.splice(index, 1);
        onSetReferences(newRefs);
    };

    return (
        <div className="fixed top-0 left-0 h-full w-80 bg-gray-900 border-r border-gray-800 flex flex-col z-50 shadow-2xl">
            {/* Header */}
            <div className="p-5 border-b border-gray-800">
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-2">
                    <Sparkles className="text-blue-400" size={20} />
                    MoodFlow v2
                </h1>
                <p className="text-xs text-gray-500 mt-1">Consistent Character Workflow</p>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                
                {/* STEP 1: SETUP */}
                {!projectPlan && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-left-4">
                        {/* Reference Upload */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 flex items-center justify-between">
                                Project References
                                <span className="text-xs text-gray-500">{referenceImages.length}/5</span>
                            </label>
                            
                            <div className="grid grid-cols-3 gap-2">
                                {referenceImages.map((img, idx) => (
                                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden group border border-gray-700">
                                        <img src={img} alt="Ref" className="w-full h-full object-cover" />
                                        <button 
                                            onClick={() => handleRemoveImage(idx)}
                                            className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                                        >
                                            <X size={16} className="text-white" />
                                        </button>
                                    </div>
                                ))}
                                {referenceImages.length < 5 && (
                                    <button 
                                        onClick={() => fileInputRef.current?.click()}
                                        className="aspect-square rounded-lg border border-dashed border-gray-700 hover:border-blue-500 hover:bg-gray-800 flex flex-col items-center justify-center gap-1 text-gray-500 hover:text-blue-400 transition-colors"
                                    >
                                        <Upload size={16} />
                                        <span className="text-[10px]">Add</span>
                                    </button>
                                )}
                            </div>
                            <input type="file" ref={fileInputRef} className="hidden" multiple accept="image/*" onChange={handleFileSelect} />
                            <p className="text-[10px] text-gray-500">Upload characters or products to keep them consistent.</p>
                        </div>

                        {/* Brief Input */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300">Project Brief</label>
                            <textarea 
                                value={brief}
                                onChange={(e) => setBrief(e.target.value)}
                                placeholder="Describe your project (e.g. 'A futuristic Nike commercial on Mars with a neon aesthetic')"
                                className="w-full h-32 bg-gray-800 border border-gray-700 rounded-xl p-3 text-sm text-white placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                            />
                        </div>

                        <button
                            onClick={() => onCreateProject(brief)}
                            disabled={!brief.trim() || isPlanning}
                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                        >
                            {isPlanning ? <Loader2 className="animate-spin" size={18}/> : <ArrowRight size={18} />}
                            {isPlanning ? 'Planning...' : 'Create Project'}
                        </button>
                    </div>
                )}

                {/* STEP 2: GENERATION */}
                {projectPlan && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                        {/* Project Header */}
                        <div className="bg-gray-800/50 p-3 rounded-xl border border-gray-700/50">
                            <h2 className="text-lg font-bold text-white leading-tight">{projectPlan.themeName}</h2>
                            <div className="flex gap-1 mt-3">
                                {projectPlan.palette.map((c, i) => (
                                    <div key={i} className="h-2 flex-1 rounded-full" style={{background: c}} />
                                ))}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-3">
                                {projectPlan.styleKeywords.map(k => (
                                    <span key={k} className="text-[10px] px-2 py-0.5 bg-gray-800 text-gray-400 border border-gray-700 rounded-full">{k}</span>
                                ))}
                            </div>
                        </div>

                        {/* Ratio & Size Selection */}
                         <div className="space-y-2">
                             <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Output Settings</label>
                             </div>
                             
                             <div className="grid grid-cols-5 gap-1 bg-gray-800 p-1 rounded-lg">
                                 {ASPECT_RATIOS.map(ratio => (
                                     <button
                                         key={ratio.value}
                                         onClick={() => setAspectRatio(ratio.value)}
                                         className={`p-2 rounded flex items-center justify-center transition-colors ${aspectRatio === ratio.value ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}
                                         title={ratio.label}
                                     >
                                         <ratio.icon size={16} />
                                     </button>
                                 ))}
                             </div>

                             <div className="grid grid-cols-4 gap-1 mt-2">
                                {RESOLUTIONS.map(res => (
                                    <button
                                        key={res}
                                        onClick={() => setImageSize(res)}
                                        className={`px-1 py-1 text-[10px] font-mono rounded border ${imageSize === res ? 'bg-purple-600/20 border-purple-500 text-purple-300' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                                    >
                                        {res}
                                    </button>
                                ))}
                             </div>
                         </div>

                        {/* Context Strip */}
                        {referenceImages.length > 0 && (
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                    <Layers size={12} /> Active Context
                                </label>
                                <div className="flex -space-x-2 overflow-hidden py-1 pl-2">
                                    {referenceImages.map((img, i) => (
                                        <img key={i} src={img} className="w-8 h-8 rounded-full border-2 border-gray-900 object-cover relative z-10 hover:z-20 hover:scale-110 transition-transform" />
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Shot List */}
                        <div className="space-y-3 pb-16">
                            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                                <Camera size={12} /> Shot List
                            </label>
                            
                            <div className="grid gap-4">
                                {projectPlan.shots.map((shot, idx) => (
                                    <div key={shot.id} className="bg-gray-800 border border-gray-700 hover:border-gray-600 rounded-xl p-3 transition-colors group relative">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-sm font-semibold text-gray-200">{shot.title}</h3>
                                            {shot.status === 'done' && <Check size={14} className="text-green-500" />}
                                            {shot.status === 'generating' && <Loader2 size={14} className="text-blue-500 animate-spin" />}
                                        </div>
                                        
                                        {/* Editable Description */}
                                        <textarea
                                            value={shot.description}
                                            onChange={(e) => onUpdateShot(shot.id, e.target.value)}
                                            className="w-full bg-gray-900/50 border border-gray-700/50 rounded-lg p-2 text-xs text-gray-400 focus:text-gray-200 focus:bg-gray-900 focus:border-blue-500/50 outline-none resize-none mb-2 min-h-[60px]"
                                            disabled={shot.status === 'generating'}
                                        />

                                        {/* Variations */}
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {SHOT_VARIATIONS.map((v, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => onUpdateShot(shot.id, shot.description + v.suffix)}
                                                    className="px-2 py-0.5 text-[10px] bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full border border-gray-600 flex items-center gap-1"
                                                    title={v.label}
                                                >
                                                    <Plus size={8}/> {v.label}
                                                </button>
                                            ))}
                                        </div>

                                        <button 
                                            onClick={() => onGenerateShot(shot, aspectRatio, imageSize, idx)}
                                            disabled={shot.status === 'generating'}
                                            className="w-full py-1.5 bg-gray-700 hover:bg-blue-600 text-xs text-white rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Sparkles size={12} />
                                            {shot.status === 'done' ? 'Regenerate' : 'Generate'}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        
                        <div className="absolute bottom-0 left-0 w-full p-4 bg-gray-900 border-t border-gray-800">
                             <button 
                                onClick={() => {
                                    if(confirm("Start new project? Project references will be reset.")) {
                                        onCreateProject(""); 
                                    }
                                }}
                                className="w-full py-2 border border-gray-700 text-gray-400 text-xs hover:text-white hover:bg-gray-800 rounded-lg"
                             >
                                Start New Project
                             </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProjectSidebar;
