import React, { useState, useCallback, useEffect } from 'react';
import { ScriptSegment, VideoConfig, VideoMetadata } from '../types';
import * as geminiService from '../services/geminiService';
import Loader from './Loader';
import { DownloadIcon } from './icons/DownloadIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';

interface DownloadPageProps {
    videoUrl: string;
    script: ScriptSegment[];
    config: VideoConfig;
    theme: string;
    onReset: () => void;
}

const aspectRatios: Record<VideoConfig['aspectRatio'], string> = {
    '16:9': 'aspect-video',
    '9:16': 'aspect-[9/16]',
    '1:1': 'aspect-square',
    '2.35:1': 'aspect-[2.35/1]',
};

const DownloadPage: React.FC<DownloadPageProps> = ({ videoUrl, script, config, theme, onReset }) => {
    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
    const [isMetadataLoading, setIsMetadataLoading] = useState(true);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});
    
    useEffect(() => {
        const handleGenerateMetadata = async () => {
            if (!script || !theme) return;
            setIsMetadataLoading(true);
            setVideoMetadata(null);
            try {
                const fullScriptText = script.map(s => s.narration).join('\n');
                const metadata = await geminiService.generateVideoMetadata(theme, fullScriptText);
                setVideoMetadata(metadata);
            } catch (e) {
                console.error("Failed to generate metadata", e);
            } finally {
                setIsMetadataLoading(false);
            }
        };
        handleGenerateMetadata();
    }, [script, theme]);

    const handleCopyToClipboard = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    };

    return (
        <div className="w-full max-w-4xl animate-fade-in-up">
            <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold mt-1 truncate" title={theme}>Your Video is Ready: "{theme}"</h2>
                <p className="text-gray-400 mt-2">Download your video and use the generated details to maximize its reach.</p>
            </div>

            <div className={`relative w-full mx-auto max-w-full ${aspectRatios[config.aspectRatio]} bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-800 mb-6`}>
                <video src={videoUrl} controls className="w-full h-full" />
            </div>

            <div className="text-center mb-12">
                <a href={videoUrl} download={`${theme.replace(/\s+/g, '_')}.webm`} className="inline-flex items-center gap-3 bg-green-600 text-white font-semibold rounded-lg px-8 py-4 text-lg hover:bg-green-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-green-500/50">
                    <DownloadIcon className="w-6 h-6" />
                    Download Video
                </a>
            </div>

            <div className="w-full">
                <div className="text-center mb-8">
                    <h3 className="text-2xl md:text-3xl font-bold">Amplify Your Reach</h3>
                    <p className="text-gray-400 mt-2">Copy the optimized content below to boost your video's discoverability.</p>
                </div>
                {isMetadataLoading && <Loader message="Crafting titles, descriptions, and more..." />}
                {videoMetadata && (
                    <div className="space-y-6 animate-fade-in-up">
                        <div>
                            <label className="text-lg font-semibold block mb-2">Title</label>
                            <div className="relative">
                                <p className="w-full bg-gray-800 rounded-md p-3 pr-12">{videoMetadata.title}</p>
                                <button onClick={() => handleCopyToClipboard(videoMetadata.title, 'title')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors rounded-md">
                                    {copiedStates['title'] ? <CheckIcon className="w-5 h-5 text-green-500"/> : <ClipboardIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-lg font-semibold block mb-2">Description</label>
                            <div className="relative">
                                <p className="w-full bg-gray-800 rounded-md p-3 pr-12 h-40 overflow-y-auto whitespace-pre-wrap">{videoMetadata.description}</p>
                                <button onClick={() => handleCopyToClipboard(videoMetadata.description, 'desc')} className="absolute right-2 top-3 p-2 text-gray-400 hover:text-white transition-colors rounded-md">
                                     {copiedStates['desc'] ? <CheckIcon className="w-5 h-5 text-green-500"/> : <ClipboardIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-lg font-semibold block mb-2">Chapters</label>
                            <div className="relative">
                                <div className="w-full bg-gray-800 rounded-md p-3 pr-12 h-40 overflow-y-auto">
                                    {videoMetadata.chapters.map(c => `${c.timestamp} - ${c.title}`).join('\n')}
                                </div>
                                <button onClick={() => handleCopyToClipboard(videoMetadata.chapters.map(c => `${c.timestamp} - ${c.title}`).join('\n'), 'chapters')} className="absolute right-2 top-3 p-2 text-gray-400 hover:text-white transition-colors rounded-md">
                                    {copiedStates['chapters'] ? <CheckIcon className="w-5 h-5 text-green-500"/> : <ClipboardIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="text-lg font-semibold block mb-2">Tags</label>
                             <div className="relative">
                                <div className="w-full bg-gray-800 rounded-md p-3 pr-12">
                                    <div className="flex flex-wrap gap-2">
                                        {videoMetadata.tags.map(tag => <span key={tag} className="bg-indigo-600/50 text-indigo-200 text-sm font-medium px-3 py-1 rounded-full">{tag}</span>)}
                                    </div>
                                </div>
                                <button onClick={() => handleCopyToClipboard(videoMetadata.tags.join(', '), 'tags')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors rounded-md">
                                     {copiedStates['tags'] ? <CheckIcon className="w-5 h-5 text-green-500"/> : <ClipboardIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DownloadPage;
