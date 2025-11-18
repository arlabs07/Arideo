import React, { useState, useRef } from 'react';
import VersionSwitcher from './VersionSwitcher';

interface PromptInputProps {
  onGenerate: (prompt: string, watermark: string | null, userImage: string | null) => void;
  initialWatermark: string | null;
  onOpenOverlay: (overlayId: string) => void;
  version: 'v1' | 'v2';
  setVersion: (version: 'v1' | 'v2') => void;
  disabled: boolean;
}

const presetButtons = [
  { id: 'short', icon: 'videocam', text: 'Create short video', color: 'text-rose-400' },
  { id: 'explainer', icon: 'quiz', text: 'Make explainer video', color: 'text-sky-400' },
  { id: 'script', icon: 'description', text: 'Use my script', color: 'text-fuchsia-400' },
  { id: 'ad', icon: 'campaign', text: 'Create UGC Ad', color: 'text-amber-400' },
];

const PromptInput: React.FC<PromptInputProps> = ({ onGenerate, initialWatermark, onOpenOverlay, version, setVersion, disabled }) => {
  const [prompt, setPrompt] = useState('');
  const [watermark, setWatermark] = useState<string | null>(initialWatermark);
  const [userImage, setUserImage] = useState<string | null>(null);
  const watermarkInputRef = useRef<HTMLInputElement>(null);
  const userImageInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt.trim(), watermark, userImage);
    }
  };

  const handleWatermarkUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setWatermark(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUserImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUserImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const PresetButton: React.FC<{ preset: typeof presetButtons[0] }> = ({ preset }) => (
    <button
      type="button"
      onClick={() => onOpenOverlay(preset.id)}
      className="flex items-center gap-2 sm:px-4 sm:py-2 p-2 bg-[#1A1A1A] text-gray-300 hover:bg-gray-800 rounded-full transition-colors text-sm"
    >
      <span className={`material-symbols-outlined ${preset.color}`}>{preset.icon}</span>
      <span className="hidden sm:inline">{preset.text}</span>
    </button>
  );

  return (
    <div className="w-full max-w-4xl flex flex-col items-start animate-fade-in-up">
       <VersionSwitcher 
          version={version} 
          setVersion={setVersion} 
          disabled={disabled}
      />
      <form onSubmit={handleSubmit} className="w-full bg-[#1A1A1A] rounded-2xl p-4 flex flex-col shadow-2xl shadow-indigo-900/20 border border-gray-800 mt-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Give me a topic, your point of view and instructions in any language"
          className="w-full h-40 bg-transparent text-gray-300 placeholder-gray-500 text-lg resize-none focus:outline-none p-4"
          required
        />
        <div className="flex justify-between items-center mt-2 p-2">
            <div className="flex items-center gap-2">
                <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleWatermarkUpload}
                    ref={watermarkInputRef}
                />
                <button
                    type="button"
                    onClick={() => watermarkInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-full transition-colors text-sm"
                >
                    <span className="material-symbols-outlined text-base">upload</span>
                    <span className="hidden sm:inline">{watermark ? 'Change' : 'Add'} Watermark</span>
                </button>

                 <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleUserImageUpload}
                    ref={userImageInputRef}
                />
                <button
                    type="button"
                    onClick={() => userImageInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-600 text-gray-300 hover:bg-gray-700 rounded-full transition-colors text-sm"
                >
                    <span className="material-symbols-outlined text-base">upload</span>
                    <span className="hidden sm:inline">{userImage ? 'Change' : 'Upload'} Asset</span>
                </button>

                {watermark && (
                    <div className="relative group">
                        <img src={watermark} alt="Watermark preview" className="h-8 w-auto rounded-sm"/>
                        <button 
                            type="button" 
                            onClick={() => setWatermark(null)}
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove watermark"
                        >
                            &#x2715;
                        </button>
                    </div>
                )}
                 {userImage && (
                    <div className="relative group">
                        <img src={userImage} alt="User asset preview" className="h-8 w-auto rounded-sm"/>
                        <button 
                            type="button" 
                            onClick={() => setUserImage(null)}
                            className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Remove user asset"
                        >
                            &#x2715;
                        </button>
                    </div>
                )}
            </div>
          
          <button
            type="submit"
            disabled={!prompt.trim()}
            className="bg-blue-600 text-white font-semibold rounded-lg px-4 sm:px-6 py-3 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 flex items-center gap-2"
          >
            <span className="hidden sm:inline">Generate my video</span>
            <span className="material-symbols-outlined">auto_awesome</span>
          </button>
        </div>
      </form>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {presetButtons.map(p => <PresetButton key={p.id} preset={p} />)}
      </div>
    </div>
  );
};

export default PromptInput;