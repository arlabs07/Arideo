import React, { useState, useRef, useEffect } from 'react';
import { ScriptSegment, ChatMessage, ToolCall, MediaAsset, MusicTrack, ScriptSegmentV2, MusicSuggestion } from '../types';
import * as geminiService from '../services/geminiService';
import { decode, decodeAudioData } from '../utils/audioUtils';

interface ChatbotProps {
    script: (ScriptSegment | ScriptSegmentV2)[] | null;
    theme: string;
    setScript: React.Dispatch<React.SetStateAction<ScriptSegment[] | null>>;
    setScriptV2: React.Dispatch<React.SetStateAction<ScriptSegmentV2[] | null>>;
    setMediaAssets: React.Dispatch<React.SetStateAction<MediaAsset[] | null>>;
    setVoiceovers: React.Dispatch<React.SetStateAction<Map<string, AudioBuffer>>>;
    audioContext: AudioContext;
    setSelectedMusic: React.Dispatch<React.SetStateAction<MusicTrack | null>>;
    generationVersion: 'v1' | 'v2';
    onOpenMusicLibrary: () => void;
}

const Chatbot: React.FC<ChatbotProps> = ({ script, theme, setScript, setScriptV2, setMediaAssets, setVoiceovers, audioContext, setSelectedMusic, generationVersion, onOpenMusicLibrary }) => {
    const [history, setHistory] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadedImage, setUploadedImage] = useState<string | null>(null);
    
    const imageInputRef = useRef<HTMLInputElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(scrollToBottom, [history]);
    
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setUploadedImage(event.target?.result as string);
                setHistory(prev => [...prev, { role: 'model', parts: [{ text: `Image "${file.name}" is ready. Tell me which scene to use it in.`}] }]);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleToolCall = async (toolCall: ToolCall) => {
        if (!script) return;
        const { name, args } = toolCall;

        if (name === 'change_visual' || name === 'add_scene' || name === 'replace_visual_with_user_image') {
            if (generationVersion === 'v2') {
                 setHistory(prev => [...prev, { role: 'model', parts: [{ text: `Editing visual elements for V2 videos via chat is coming soon! For now, you can change narrations or the background music.` }] }]);
                 return;
            }
        }

        if (name === 'change_visual') {
            const { scene_number, new_visual_description } = args;
            const sceneIndex = scene_number - 1;
            if (sceneIndex < 0 || sceneIndex >= script.length) {
                 setHistory(prev => [...prev, { role: 'model', parts: [{ text: `Sorry, I couldn't find scene ${scene_number}.` }] }]);
                 return;
            }
            try {
                const newImageUrl = await geminiService.generateVisual(new_visual_description);
                setMediaAssets(prev => {
                    if (!prev) return null;
                    const newAssets = [...prev];
                    const assetIndex = newAssets.findIndex(a => a.segmentId === script[sceneIndex].id);
                    if (assetIndex !== -1) {
                        newAssets[assetIndex] = { ...newAssets[assetIndex], url: newImageUrl, description: new_visual_description };
                    }
                    return newAssets;
                });
            } catch(e) {
                 setHistory(prev => [...prev, { role: 'model', parts: [{ text: `I failed to generate the new visual. Please try again.` }] }]);
            }
        } else if (name === 'change_narration') {
            const { scene_number, new_narration_text } = args;
            const sceneIndex = scene_number - 1;
             if (sceneIndex < 0 || sceneIndex >= script.length) {
                 setHistory(prev => [...prev, { role: 'model', parts: [{ text: `Sorry, I couldn't find scene ${scene_number}.` }] }]);
                 return;
            }
            try {
                const currentVoice = (script[sceneIndex] as ScriptSegment)?.voice || (script[sceneIndex] as ScriptSegmentV2)?.voice || 'Puck';
                const audioB64 = await geminiService.generateVoiceover(new_narration_text, currentVoice);
                const decodedAudio = decode(audioB64);
                const audioBuffer = await decodeAudioData(decodedAudio, audioContext, 24000, 1);
                
                const segmentId = script[sceneIndex].id;

                const scriptUpdater = generationVersion === 'v1' ? setScript : setScriptV2;
                scriptUpdater(prev => {
                    if(!prev) return null;
                    const newScript = [...prev] as any[];
                    newScript[sceneIndex] = { ...newScript[sceneIndex], narration: new_narration_text };
                    return newScript as any;
                });

                setVoiceovers(prev => {
                    const newVoiceovers = new Map(prev);
                    newVoiceovers.set(segmentId, audioBuffer);
                    return newVoiceovers;
                });

            } catch (e) {
                setHistory(prev => [...prev, { role: 'model', parts: [{ text: `I failed to generate the new voiceover. Please try again.` }] }]);
            }

        } else if (name === 'add_scene') {
            const { visual_description, narration_text, voice } = args;
             try {
                const newImageUrl = await geminiService.generateVisual(visual_description);
                const audioB64 = await geminiService.generateVoiceover(narration_text, voice || 'Puck');
                const decodedAudio = decode(audioB64);
                const audioBuffer = await decodeAudioData(decodedAudio, audioContext, 24000, 1);

                const newSegment: ScriptSegment = {
                    id: `segment-${Date.now()}`,
                    timestamp: "00:00 - 00:00",
                    visuals: visual_description,
                    narration: narration_text,
                    transition: "Cut to",
                    voice: voice || 'Puck'
                };
                 const newMediaAsset: MediaAsset = {
                    segmentId: newSegment.id,
                    type: 'image',
                    url: newImageUrl,
                    description: visual_description
                };

                setScript(prev => prev ? [...prev, newSegment] : [newSegment]);
                setMediaAssets(prev => prev ? [...prev, newMediaAsset] : [newMediaAsset]);
                setVoiceovers(prev => new Map(prev).set(newSegment.id, audioBuffer));

            } catch (e) {
                setHistory(prev => [...prev, { role: 'model', parts: [{ text: `I failed to create the new scene. Please try again.` }] }]);
            }
        } else if (name === 'replace_visual_with_user_image') {
            const { scene_number } = args;
            const sceneIndex = scene_number - 1;
            if (sceneIndex < 0 || sceneIndex >= script.length) {
                setHistory(prev => [...prev, { role: 'model', parts: [{ text: `Sorry, I couldn't find scene ${scene_number}.` }] }]);
                return;
            }
            if (!uploadedImage) {
                setHistory(prev => [...prev, { role: 'model', parts: [{ text: "You haven't uploaded an image. Please upload one first." }] }]);
                return;
            }
            setMediaAssets(prev => {
                if (!prev) return null;
                const newAssets = [...prev];
                const assetIndex = newAssets.findIndex(a => a.segmentId === script[sceneIndex].id);
                if (assetIndex !== -1) {
                    newAssets[assetIndex] = { ...newAssets[assetIndex], url: uploadedImage };
                }
                return newAssets;
            });
            setUploadedImage(null); // consume image
        } else if (name === 'change_background_music') {
            const { mood, genre } = args;
            let suggestion: MusicSuggestion | null = null;

            if (mood || genre) {
                suggestion = { mood: mood || 'any', genre: genre || 'any' };
            } else {
                const fullScriptText = script.map(s => s.narration).join('\n');
                suggestion = await geminiService.generateMusicSuggestion(fullScriptText);
            }

            if (suggestion) {
                try {
                    const newTrack = await geminiService.selectMusicTrack(theme, suggestion);
                    if (newTrack) {
                        setSelectedMusic(newTrack);
                        setHistory(prev => [...prev, { role: 'model', parts: [{ text: `I've changed the background music to "${newTrack.title}". Let me know what you think!` }] }]);
                    } else {
                        setHistory(prev => [...prev, { role: 'model', parts: [{ text: "I couldn't find a suitable new track. Please try a different suggestion." }] }]);
                    }
                } catch (e) {
                    setHistory(prev => [...prev, { role: 'model', parts: [{ text: "I had trouble changing the music. Please try again." }] }]);
                }
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isProcessing || !script) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: input }] };
        const newHistory = [...history, userMessage];
        setHistory(newHistory);
        setInput('');
        setIsProcessing(true);

        try {
            // NOTE: Chatbot currently only supports V1 script format for full context
            const contextScript = generationVersion === 'v1' ? (script as ScriptSegment[]) : [];
            const { text, toolCalls } = await geminiService.processChatRequest(newHistory, contextScript);

            if (text) {
                setHistory(prev => [...prev, { role: 'model', parts: [{ text }] }]);
            }

            if (toolCalls && toolCalls.length > 0) {
                for (const toolCall of toolCalls) {
                    await handleToolCall(toolCall);
                }
            }
        } catch(error) {
            console.error("Chat processing error:", error);
            setHistory(prev => [...prev, { role: 'model', parts: [{ text: "I'm having trouble connecting right now. Please try again later."}] }]);
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="bg-gray-900/50 border border-gray-700 rounded-lg flex flex-col h-full max-h-[75vh] lg:max-h-full shadow-lg">
            <div className="p-4 border-b border-gray-700 flex-shrink-0 flex justify-between items-center">
                <div>
                    <h3 className="font-semibold text-lg text-white">AI Video Assistant</h3>
                    <p className="text-sm text-gray-400">Tell me what you want to change.</p>
                </div>
                <button
                    onClick={onOpenMusicLibrary}
                    className="flex items-center gap-2 px-3 py-2 bg-purple-600/20 text-purple-300 border border-purple-600/50 rounded-lg hover:bg-purple-600/40 transition-colors text-sm font-semibold"
                    title="Open Music Library"
                >
                    <span className="material-symbols-outlined text-base">music_note</span>
                    <span>Library</span>
                </button>
            </div>
            <div className="flex-grow p-4 space-y-4 overflow-y-auto">
                {history.map((msg, index) => (
                    <div key={index} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                        {msg.role === 'model' && <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>}
                        <div className={`max-w-xs md:max-w-sm rounded-lg px-4 py-2 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200'}`}>
                            <p className="whitespace-pre-wrap">{msg.parts[0].text}</p>
                        </div>
                    </div>
                ))}
                 {isProcessing && (
                    <div className="flex gap-3">
                         <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 text-sm font-bold">AI</div>
                        <div className="max-w-xs md:max-w-sm rounded-lg px-4 py-2 bg-gray-700 text-gray-200 flex items-center">
                            <span className="w-2 h-2 bg-white rounded-full animate-[pulse_1.5s_ease-in-out_infinite]"></span>
                            <span className="w-2 h-2 bg-white rounded-full animate-[pulse_1.5s_ease-in-out_infinite_0.2s] mx-1"></span>
                            <span className="w-2 h-2 bg-white rounded-full animate-[pulse_1.s_ease-in-out_infinite_0.4s]"></span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSubmit} className="p-4 border-t border-gray-700 flex-shrink-0">
                <div className="flex flex-wrap gap-2 mb-2">
                    {uploadedImage && (
                        <div className="relative w-16 h-16 group">
                            <img src={uploadedImage} alt="Uploaded preview" className="w-full h-full object-cover rounded-md" />
                            <button 
                                type="button" 
                                onClick={() => setUploadedImage(null)}
                                className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full h-5 w-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                aria-label="Remove uploaded image"
                            >
                                &#x2715;
                            </button>
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 bg-gray-800 rounded-lg pr-2">
                     <input type="file" accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageUpload} />
                    <button type="button" onClick={() => imageInputRef.current?.click()} className="p-3 text-gray-400 hover:text-white transition-colors" title="Upload Image">
                        <span className="material-symbols-outlined">upload</span>
                    </button>
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="e.g., Change music to upbeat"
                        className="w-full bg-transparent p-3 focus:outline-none text-gray-200 placeholder-gray-500"
                        disabled={isProcessing}
                    />
                     <button type="submit" disabled={!input.trim() || isProcessing} className="bg-indigo-600 text-white rounded-md p-2 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                        <span className="material-symbols-outlined">auto_awesome</span>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default Chatbot;