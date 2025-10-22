import React, { useState, useEffect, useRef } from 'react';
import { VoiceIcon } from './icons/VoiceIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { SubtitlesIcon } from './icons/SubtitlesIcon';
import { VisualsIcon } from './icons/VisualsIcon';
import { CheckIcon } from './icons/CheckIcon';
import { CloseIcon } from './icons/CloseIcon';

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

const settingButtonsConfig = [
    { id: 'voice', icon: VoiceIcon, text: 'Voice Actors' },
    { id: 'music', icon: MusicNoteIcon, text: 'Music Preference' },
    { id: 'subtitles', icon: SubtitlesIcon, text: 'Subtitles' },
    { id: 'visuals', icon: VisualsIcon, text: 'Visual Style' },
];

const CustomSelect = ({ options, value, onChange, id, activeDropdown, setActiveDropdown }) => {
    const isOpen = activeDropdown === id;
    const selectedLabel = options.find(opt => opt.value === value)?.label || '';
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [id, setActiveDropdown]);

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                type="button"
                className="bg-transparent border-b-2 border-gray-500 hover:border-gray-400 focus:border-indigo-500 focus:outline-none transition-colors py-1 px-2 font-semibold text-white"
                onClick={() => setActiveDropdown(isOpen ? null : id)}
            >
                {selectedLabel} &#9662;
            </button>
            {isOpen && (
                <div className="absolute z-10 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg">
                    {options.map(opt => (
                        <button
                            key={opt.value}
                            type="button"
                            className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-indigo-600"
                            onClick={() => { onChange(opt.value); setActiveDropdown(null); }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

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
    const [duration, setDuration] = useState('30');
    const [platform, setPlatform] = useState('YouTube Shorts');
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Settings state
    const [settings, setSettings] = useState({
        voice: 'Puck',
        musicPreference: '',
        subtitles: true,
        visualStyle: 'Generative AI',
    });
    const [activeSetting, setActiveSetting] = useState<string | null>(null);

    useEffect(() => {
        // Reset state when overlay changes
        setTopic(''); setExtraInfo(''); setScript(''); setProduct('');
        setActiveDropdown(null); setActiveSetting(null);
        setSettings({ voice: 'Puck', musicPreference: '', subtitles: true, visualStyle: 'Generative AI' });
        
        switch(activeOverlay) {
            case 'short': setDuration('30'); setPlatform('YouTube Shorts'); break;
            case 'explainer': setDuration('180'); setPlatform('YouTube'); break;
            case 'script': setPlatform('YouTube'); break;
            case 'ad': setDuration('30'); setPlatform('TikTok'); break;
        }
    }, [activeOverlay]);

    const config = overlayConfig[activeOverlay as keyof typeof overlayConfig];
    if (!config) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        let basePrompt = '';
        switch(activeOverlay) {
            case 'short': basePrompt = `Create a ${duration}-second video for ${platform} about "${topic}".`; break;
            case 'explainer': basePrompt = `Create a ${duration}-second explainer video for ${platform} about "${topic}". Additional info: ${extraInfo}`; break;
            case 'script': basePrompt = `Create a video for ${platform} using exactly this script: "${script}"`; break;
            case 'ad': basePrompt = `Create a ${duration}-second UGC ad for the product "${product}" for ${platform}.`; break;
        }

        const settingsText = `
---
Video Settings:
- Voice Actor: ${settings.voice}
- Music Preference: ${settings.musicPreference || 'AI Selected based on mood'}
- Subtitles: ${settings.subtitles ? 'Yes' : 'No'}
- Visual Style: ${settings.visualStyle}
---
        `;

        if (basePrompt) onGenerate(basePrompt + settingsText, watermark);
    };

    const renderFormFields = () => {
        switch(activeOverlay) {
            case 'short':
                return (
                    <>
                        <div className="text-lg mb-4 text-gray-300">
                            Create a&nbsp;
                            <CustomSelect id="duration" activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} value={duration} onChange={setDuration} options={[ { value: '15', label: '15 second' }, { value: '30', label: '30 second' }, { value: '60', label: '1 minute' } ]}/>
                            &nbsp;video for&nbsp;
                            <CustomSelect id="platform" activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} value={platform} onChange={setPlatform} options={[ { value: 'YouTube Shorts', label: 'YouTube Shorts' }, { value: 'TikTok', label: 'TikTok' }, { value: 'Instagram Reels', label: 'Instagram Reels' }]} />
                            &nbsp;about
                        </div>
                        <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="Type your topic here" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" required />
                    </>
                );
            case 'explainer':
                return (
                     <>
                        <div className="text-lg mb-4 text-gray-300">
                             Create a&nbsp;
                            <CustomSelect id="duration" activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} value={duration} onChange={setDuration} options={[ { value: '60', label: '1 minute' }, { value: '180', label: '3 minutes' }, { value: '300', label: '5 minutes' } ]}/>
                            &nbsp;video for&nbsp;
                            <CustomSelect id="platform" activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} value={platform} onChange={setPlatform} options={[ { value: 'YouTube', label: 'YouTube' }, { value: 'Vimeo', label: 'Vimeo' }, { value: 'a Website', label: 'a Website' }]} />
                            &nbsp;about
                        </div>
                        <textarea value={topic} onChange={e => setTopic(e.target.value)} placeholder="Type your topic here" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none mb-4" required />
                        <textarea value={extraInfo} onChange={e => setExtraInfo(e.target.value)} placeholder="Add relevant information and opinions about the video." className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" />
                    </>
                );
            case 'script':
                return (
                     <>
                        <div className="text-lg mb-4 text-gray-300">
                             Create a video for&nbsp;
                            <CustomSelect id="platform" activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} value={platform} onChange={setPlatform} options={[ { value: 'YouTube', label: 'YouTube' }, { value: 'TikTok', label: 'TikTok' }, { value: 'Instagram', label: 'Instagram' } ]} />
                            &nbsp;using exactly this script
                        </div>
                        <textarea value={script} onChange={e => setScript(e.target.value)} placeholder="Paste your script here" className="w-full h-40 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" required />
                    </>
                );
            case 'ad':
                return (
                    <>
                        <div className="text-lg mb-4 text-gray-300">
                            Create a&nbsp;
                            <CustomSelect id="duration" activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} value={duration} onChange={setDuration} options={[ { value: '15', label: '15 second' }, { value: '30', label: '30 second' }, { value: '45', label: '45 second' } ]}/>
                            &nbsp;UGC Ad for&nbsp;
                            <CustomSelect id="platform" activeDropdown={activeDropdown} setActiveDropdown={setActiveDropdown} value={platform} onChange={setPlatform} options={[ { value: 'TikTok', label: 'TikTok' }, { value: 'Instagram', label: 'Instagram' }, { value: 'Facebook', label: 'Facebook' } ]} />
                            &nbsp;about
                        </div>
                        <textarea value={product} onChange={e => setProduct(e.target.value)} placeholder="Your product or service" className="w-full h-24 bg-gray-900/50 border border-gray-700 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none" required />
                    </>
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
            case 'music':
                content = (
                    <div>
                        <label htmlFor="music-pref" className="font-semibold mb-2 block">Music Preference</label>
                        <input id="music-pref" type="text" value={settings.musicPreference} onChange={e => handleUpdate('musicPreference', e.target.value)} placeholder="e.g., upbeat, cinematic, lo-fi beats" className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"/>
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
            case 'visuals':
                 content = (
                    <div>
                        <h4 className="font-semibold mb-3">Visual Style</h4>
                        <div className="flex gap-3">
                            {['Generative AI', 'Stock Footage'].map(style => (
                                <button key={style} type="button" onClick={() => handleUpdate('visualStyle', style)} className={`flex-1 p-3 rounded-lg transition-all ${settings.visualStyle === style ? 'bg-indigo-600 ring-2 ring-indigo-400' : 'bg-gray-700 hover:bg-gray-600'}`}>
                                    {style}
                                </button>
                            ))}
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
        <div className="bg-[#101010] rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl shadow-indigo-900/20 border border-gray-800 flex flex-col animate-fade-in-up" onClick={e => e.stopPropagation()}>
          <div className="relative h-48 flex-shrink-0">
             <img src={config.backgroundImage} alt={config.title} className="w-full h-full object-cover"/>
             <div className="absolute inset-0 bg-gradient-to-t from-[#101010] to-transparent"></div>
             <button onClick={onClose} className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl z-10">&times;</button>
             <h2 className="absolute bottom-6 left-6 text-3xl font-bold">{config.title}</h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">
            <div className="space-y-4">
              {renderFormFields()}
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-400 mb-3">Settings:</h3>
              <div className="flex flex-wrap gap-2">
                {settingButtonsConfig.map(s => {
                    const isActive = activeSetting === s.id;
                    const isSet = (settings[s.id as keyof typeof settings] && settings[s.id as keyof typeof settings] !== (s.id === 'subtitles' ? false : '')) || s.id === 'voice'; // Voice always has a default
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

            <div className="flex justify-end items-center gap-4 pt-4 sticky bottom-0 bg-[#101010] -mx-6 -mb-6 px-6 pb-6">
              <button type="button" onClick={onClose} className="text-gray-400 hover:text-white transition-colors px-6 py-2">Back</button>
              <button type="submit" className="bg-blue-600 text-white font-semibold rounded-lg px-8 py-3 hover:bg-blue-700 disabled:bg-gray-700 transition-all transform hover:scale-105">Proceed</button>
            </div>
          </form>
        </div>
      </div>
    );
};

export default Overlay;
