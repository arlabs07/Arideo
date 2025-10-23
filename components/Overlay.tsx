import React, { useState, useEffect } from 'react';
import { VoiceIcon } from './icons/VoiceIcon';
import { SubtitlesIcon } from './icons/SubtitlesIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CloseIcon } from './CloseIcon';
import { AspectRatioIcon } from './icons/AspectRatioIcon';
import { TimingIcon } from './icons/TimingIcon';

interface OverlayProps {
  activeOverlay: string;
  onClose: () => void;
  onGenerate: (prompt: string, watermark: string | null) => void;
  watermark: string | null;
}

const overlayConfig = {
  short: {
    title: 'Create short video',
    backgroundImage: 'https://images.pexels.com/photos/1484516/pexels-photo-1484516.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
  },
  explainer: {
    title: 'Create explainer video',
    backgroundImage: 'https://images.pexels.com/photos/5989933/pexels-photo-5989933.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
  },
  script: {
    title: 'Use my script',
    backgroundImage: 'https://images.pexels.com/photos/1117132/pexels-photo-1117132.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
  },
  ad: {
    title: 'Create UGC Ad',
    backgroundImage: 'https://images.pexels.com/photos/6954032/pexels-photo-6954032.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2',
  }
};

const voices = [
    { id: 'Puck', name: 'Puck', description: 'Male, Versatile' },
    { id: 'Kore', name: 'Kore', description: 'Female, Professional' },
    { id: 'Zephyr', name: 'Zephyr', description: 'Male, Calm' },
    { id: 'Fenrir', name: 'Fenrir', description: 'Female, Energetic' },
];

const aspectRatios = [
    { id: '9:16', name: 'Portrait' },
    { id: '16:9', name: 'Landscape' },
    { id: '1:1', name: 'Square' },
];

const durations = [
    { id: '15', name: '15s' },
    { id: '30', name: '30s' },
    { id: '60', name: '60s' },
    { id: '180', name: '3min' },
];


const settingButtonsConfig = [
    { id: 'voice', icon: VoiceIcon, text: 'Voice Actor' },
    { id: 'timing', icon: TimingIcon, text: 'Timing' },
    { id: 'aspectRatio', icon: AspectRatioIcon, text: 'Aspect Ratio' },
    { id: 'subtitles', icon: SubtitlesIcon, text: 'Subtitles' },
];

const OptionButtonGroup = ({ options, selected, onSelect, className = '' }: { options: { id: string, name: string}[], selected: string, onSelect: (id: string) => void, className?: string}) => (
    <div className={`flex items-center gap-2 p-1 bg-gray-900/50 rounded-lg ${className}`}>
        {options.map(opt => (
            <button
                key={opt.id}
                type="button"
                onClick={() => onSelect(opt.id)}
                className={`px-3 py-1 text-sm rounded-md transition-all duration-200 ${selected === opt.id ? 'bg-indigo-600 text-white shadow' : 'text-gray-300 hover:bg-gray-700'}`}
            >
                {opt.name}
            </button>
        ))}
    </div>
);


const Overlay: React.FC<OverlayProps> = ({ activeOverlay, onClose, onGenerate, watermark }) => {
    useEffect(() => {
        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [onClose]);

    // Form state
    const [topic, setTopic] = useState('');
    const [extraInfo, setExtraInfo] = useState('');
    const [script, setScript] = useState('');
    const [product, setProduct] = useState('');
    
    // Settings state
    const [settings, setSettings] = useState({
        voice: 'Puck',
        subtitles: true,
        aspectRatio: '9:16',
        duration: '30'
    });
    const [activeSetting, setActiveSetting] = useState<string | null>(null);

    useEffect(() => {
        // Reset state when overlay changes
        setTopic(''); setExtraInfo(''); setScript(''); setProduct('');
        setActiveSetting(null);
        
        let newAspectRatio = '9:16';
        let newDuration = '30';

        switch(activeOverlay) {
            case 'short': newAspectRatio = '9:16'; newDuration = '30'; break;
            case 'explainer': newAspectRatio = '16:9'; newDuration = '180'; break;
            case 'script': newAspectRatio = '16:9'; newDuration = '60'; break;
            case 'ad': newAspectRatio = '9:16'; newDuration = '30'; break;
        }
        setSettings({ voice: 'Puck', subtitles: true, aspectRatio: newAspectRatio, duration: newDuration });

    }, [activeOverlay]);

    const config = overlayConfig[activeOverlay as keyof typeof overlayConfig];
    if (!config) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let basePrompt = '';
        switch(activeOverlay) {
            case 'short': basePrompt = `Create a short video about "${topic}".`; break;
            case 'explainer': basePrompt = `Create an explainer video about "${topic}". Additional info: ${extraInfo}`; break;
            case 'script': basePrompt = `Create a video using exactly this script: "${script}"`; break;
            case 'ad': basePrompt = `Create a UGC ad for the product "${product}".`; break;
        }

        const settingsText = `
---
Video Settings:
- Duration: ${settings.duration} seconds
- Aspect Ratio: ${settings.aspectRatio}
- Voice Actor: ${settings.voice}
- Subtitles: ${settings.subtitles ? 'Yes' : 'No'}
---
        `;

        if (basePrompt) onGenerate(basePrompt + settingsText, watermark);
    };

    const renderFormFields = () => {
        switch(activeOverlay) {
            case 'short':
                return (
                    <div>
                        <label className="font-semibold mb-2 block text-gray-300">Topic:</label>
                        <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., The history of the Eiffel Tower" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" required />
                    </div>
                );
            case 'explainer':
                return (
                     <div className="space-y-4">
                        <div>
                            <label className="font-semibold mb-2 block text-gray-300">Topic:</label>
                            <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g., How does photosynthesis work?" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" required />
                        </div>
                         <div>
                            <label className="font-semibold mb-2 block text-gray-300">Additional Info:</label>
                            <textarea value={extraInfo} onChange={e => setExtraInfo(e.target.value)} placeholder="Add relevant information, key points to cover, and opinions for the video." className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" />
                        </div>
                    </>
                );
            case 'script':
                return (
                     <div>
                        <label className="font-semibold mb-2 block text-gray-300">Script:</label>
                        <textarea value={script} onChange={e => setScript(e.target.value)} placeholder="Paste your full video script here." className="w-full h-40 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" required />
                    </div>
                );
            case 'ad':
                return (
                     <div>
                        <label className="font-semibold mb-2 block text-gray-300">Product / Service:</label>
                        <textarea value={product} onChange={e => setProduct(e.target.value)} placeholder="e.g., 'A new productivity app called FlowState'" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" required />
                    </div>
                );
            default: return null;
        }
    };

    const renderSettingsPanel = () => {
        if (!activeSetting) return null;

        const handleUpdate = (key: keyof typeof settings, value: any) => {
            setSettings(prev => ({ ...prev, [key]: value }));
        };

        let content;
        switch(activeSetting) {
            case 'voice':
                content = (
                    <div>
                        <h4 className="font-semibold mb-3">Select a Voice</h4>
                        <div className="grid grid-cols-2 gap-3">
                            {voices.map(v => (
                                <button key={v.id} type="button" onClick={() => handleUpdate('voice', v.id)} className={`p-3 rounded-lg text-left transition-all ${settings.voice === v.id ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                    <p className="font-semibold">{v.name}</p>
                                    <p className="text-sm text-gray-300">{v.description}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                );
                break;
            case 'timing':
                content = (
                    <div>
                        <h4 className="font-semibold mb-3">Video Duration</h4>
                        <OptionButtonGroup options={durations} selected={settings.duration} onSelect={(id) => handleUpdate('duration', id)} />
                    </div>
                );
                break;
            case 'aspectRatio':
                content = (
                    <div>
                        <h4 className="font-semibold mb-3">Aspect Ratio</h4>
                        <OptionButtonGroup options={aspectRatios} selected={settings.aspectRatio} onSelect={(id) => handleUpdate('aspectRatio', id)} />
                    </div>
                );
                break;
            case 'subtitles':
                content = (
                     <div>
                        <h4 className="font-semibold mb-3">Subtitles</h4>
                        <div className="flex items-center gap-4 bg-gray-700 p-3 rounded-lg">
                            <label htmlFor="subtitles-toggle" className="flex-grow">Display subtitles on the video</label>
                            <button type="button" role="switch" aria-checked={settings.subtitles} onClick={() => handleUpdate('subtitles', !settings.subtitles)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${settings.subtitles ? 'bg-indigo-600' : 'bg-gray-600'}`}>
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.subtitles ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                );
                break;
            default: content = null;
        }

        return (
            <div className="mt-4 bg-gray-900/70 p-4 rounded-lg border border-gray-700 relative animate-fade-in-up">
                 <button type="button" onClick={() => setActiveSetting(null)} className="absolute top-2 right-2 p-1 text-gray-400 hover:text-white"><CloseIcon className="w-5 h-5"/></button>
                 {content}
            </div>
        );
    };

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-[#101010] rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl shadow-indigo-900/20 border border-gray-800 flex flex-col animate-fade-in-up overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="relative h-48 flex-shrink-0">
             <img src={config.backgroundImage} alt={config.title} className="w-full h-full object-cover"/>
             <div className="absolute inset-0 bg-gradient-to-t from-[#101010] to-transparent"></div>
             <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl z-10">&times;</button>
             <h2 className="absolute bottom-6 left-6 text-3xl font-bold">{config.title}</h2>
          </div>
          <form onSubmit={handleSubmit} className="flex-grow p-6 space-y-6 overflow-y-auto">
            <div className="space-y-4">
              {renderFormFields()}
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Settings:</h3>
              <div className="flex flex-wrap gap-2">
                {settingButtonsConfig.map(s => {
                    const isActive = activeSetting === s.id;
                    const isSet = !!settings[s.id as keyof typeof settings] || s.id === 'voice';
                    return (
                        <button key={s.id} type="button" onClick={() => setActiveSetting(isActive ? null : s.id)} className={`flex items-center gap-2 px-3 py-2 border rounded-md transition-colors text-sm ${isActive ? 'bg-indigo-600 border-indigo-500 text-white' : isSet ? 'bg-gray-700 border-gray-600 text-gray-200 hover:bg-gray-600' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                            <s.icon className={`w-4 h-4 ${isActive ? 'text-white' : isSet ? 'text-indigo-300' : 'text-gray-500'}`} />
                            <span>{s.text}</span>
                            {!isActive && isSet && <CheckIcon className="w-4 h-4 text-green-400" />}
                        </button>
                    )
                })}
              </div>
              {renderSettingsPanel()}
            </div>
            <div className="flex justify-end items-center gap-4 pt-6">
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors px-6 py-2">Back</button>
              <button type="submit" className="bg-blue-600 text-white font-semibold rounded-lg px-8 py-3 hover:bg-blue-700 disabled:bg-gray-700 transition-all transform hover:scale-105">Proceed</button>
            </div>
          </form>
        </div>
      </div>
    );
};

export default Overlay;
