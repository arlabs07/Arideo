import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ScriptSegment, MediaAsset, VideoConfig, MusicSuggestion, MusicTrack, VideoMetadata } from '../types';
import * as geminiService from '../services/geminiService';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { FullscreenIcon } from './icons/FullscreenIcon';
import { MusicNoteIcon } from './icons/MusicNoteIcon';
import { ClipboardIcon } from './icons/ClipboardIcon';
import { CheckIcon } from './icons/CheckIcon';
import Loader from './Loader';

interface VideoPreviewProps {
  script: ScriptSegment[];
  mediaAssets: MediaAsset[];
  voiceovers: Map<string, AudioBuffer>;
  audioContext: AudioContext;
  onReset: () => void;
  theme: string;
  config: VideoConfig;
  watermark: string | null;
  musicSuggestion: MusicSuggestion | null;
  selectedMusic: MusicTrack | null;
}

const formatTime = (seconds: number) => {
    const floorSeconds = Math.floor(seconds);
    const min = Math.floor(floorSeconds / 60);
    const sec = floorSeconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

const aspectRatios: Record<VideoConfig['aspectRatio'], string> = {
    '16:9': 'aspect-video',
    '9:16': 'aspect-[9/16]',
    '1:1': 'aspect-square',
    '2.35:1': 'aspect-[2.35/1]',
};

const animationClasses = ['ken-burns-in', 'ken-burns-out', 'ken-burns-pan-right', 'ken-burns-pan-up', 'ken-burns-pan-left', 'ken-burns-pan-down'];

const VideoPreview: React.FC<VideoPreviewProps> = ({ script, mediaAssets, voiceovers, audioContext, theme, config, watermark, musicSuggestion, selectedMusic }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isRendering, setIsRendering] = useState(false);
    const [renderingMessage, setRenderingMessage] = useState('');
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [musicBuffer, setMusicBuffer] = useState<AudioBuffer | null>(null);
    const [musicLoadingState, setMusicLoadingState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle');

    const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
    const [isMetadataLoading, setIsMetadataLoading] = useState(false);
    const [copiedStates, setCopiedStates] = useState<Record<string, boolean>>({});

    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const musicGainRef = useRef<GainNode | null>(null);
    const progressIntervalRef = useRef<number | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
    const renderFrameId = useRef<number | null>(null);
    
    const segmentDurations = useMemo(() => script.map(s => voiceovers.get(s.id)?.duration || 0), [script, voiceovers]);
    const totalDuration = useMemo(() => segmentDurations.reduce((acc, dur) => acc + dur, 0), [segmentDurations]);

    const sceneAnimations = useMemo(() => {
        return mediaAssets.map((_, index) => animationClasses[(index * 3 + Math.floor(index / animationClasses.length)) % animationClasses.length]);
    }, [mediaAssets]);

    useEffect(() => {
        if (selectedMusic) {
            const fetchMusic = async () => {
                setMusicLoadingState('loading');
                try {
                    const response = await fetch(selectedMusic.url);
                    if (!response.ok) throw new Error(`Failed to fetch music: ${response.status} ${response.statusText}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    setMusicBuffer(decodedBuffer);
                    setMusicLoadingState('loaded');
                } catch (e) { 
                    console.error("Failed to load background music", e); 
                    setMusicLoadingState('error');
                }
            };
            fetchMusic();
        }
    }, [selectedMusic, audioContext]);

    const cleanupPlayback = useCallback(() => {
        if (audioSourceRef.current) {
            audioSourceRef.current.onended = null;
            try { audioSourceRef.current.stop(); } catch (e) {}
            audioSourceRef.current.disconnect();
            audioSourceRef.current = null;
        }
         if (musicSourceRef.current) {
            try { musicSourceRef.current.stop(); } catch (e) {}
            musicSourceRef.current.disconnect();
            musicSourceRef.current = null;
        }
        if (musicGainRef.current) {
            musicGainRef.current.disconnect();
            musicGainRef.current = null;
        }
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
            progressIntervalRef.current = null;
        }
    }, []);
    
    useEffect(() => {
        let segmentTimeout: number;
        const playSegment = (index: number) => {
            if (audioSourceRef.current) {
                try { audioSourceRef.current.stop(); } catch (e) {}
                audioSourceRef.current.disconnect();
            }
            if (index >= script.length) {
                setIsPlaying(false);
                setCurrentSegmentIndex(0);
                setProgress(100);
                setCurrentTime(totalDuration);
                return;
            }
            setCurrentSegmentIndex(index);
            const segment = script[index];
            const voiceover = voiceovers.get(segment.id);
            const duration = voiceover?.duration || 0;
            const timeElapsedSoFar = segmentDurations.slice(0, index).reduce((acc, dur) => acc + dur, 0);
            if (voiceover && isPlaying) {
                const source = audioContext.createBufferSource();
                source.buffer = voiceover;
                source.connect(audioContext.destination);
                source.start();
                audioSourceRef.current = source;
                const startTime = Date.now();
                if(progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = window.setInterval(() => {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const newCurrentTime = timeElapsedSoFar + elapsed;
                    if (newCurrentTime <= totalDuration) {
                        setCurrentTime(newCurrentTime);
                        setProgress((newCurrentTime / totalDuration) * 100);
                    }
                }, 100);
                segmentTimeout = window.setTimeout(() => { if (isPlaying) playSegment(index + 1); }, duration * 1000);
            }
        };
        if (isPlaying) {
            if (audioContext.state === 'suspended') audioContext.resume();
            playSegment(currentSegmentIndex);
            if (musicBuffer && !musicSourceRef.current) {
                const gainNode = audioContext.createGain();
                gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                gainNode.connect(audioContext.destination);
                musicGainRef.current = gainNode;
                const source = audioContext.createBufferSource();
                source.buffer = musicBuffer;
                source.loop = true;
                source.connect(gainNode);
                source.start();
                musicSourceRef.current = source;
            }
        } else {
            cleanupPlayback();
            clearTimeout(segmentTimeout);
        }
        return () => {
            cleanupPlayback();
            clearTimeout(segmentTimeout);
        };
    }, [isPlaying, currentSegmentIndex, script, voiceovers, audioContext, totalDuration, cleanupPlayback, segmentDurations, musicBuffer]);

    const handleTogglePlay = () => {
        if (isPlaying) setIsPlaying(false);
        else {
            if (progress >= 100) {
                setCurrentSegmentIndex(0);
                setProgress(0);
                setCurrentTime(0);
            }
            setIsPlaying(true);
        }
    };
    
    const handleFullscreen = () => {
        if (fullscreenContainerRef.current) {
            if (document.fullscreenElement) document.exitFullscreen();
            else fullscreenContainerRef.current.requestFullscreen().catch(err => console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`));
        }
    };

    const handleDownload = useCallback(async () => {
        if (isRendering) return;
        setIsRendering(true);
        setDownloadUrl(null);
        const drawCaption = (ctx: CanvasRenderingContext2D, text: string, canvasWidth: number, canvasHeight: number) => {
            const maxTextWidth = canvasWidth * 0.9;
            const words = text.split(' ');
            let line = '';
            const lines: string[] = [];
            const fontSize = Math.floor(canvasHeight / (config.aspectRatio === '9:16' ? 28 : 22));
            ctx.font = `900 ${fontSize}px 'Inter', sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxTextWidth && n > 0) {
                    lines.push(line.trim());
                    line = words[n] + ' ';
                } else line = testLine;
            }
            lines.push(line.trim());
            const lineHeight = fontSize * 1.3;
            const totalTextHeight = lines.length * lineHeight;
            const y = canvasHeight * 0.80 - totalTextHeight + lineHeight;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.9)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
            ctx.fillStyle = 'white';
            lines.forEach((currentLine, index) => ctx.fillText(currentLine, canvasWidth / 2, y + index * lineHeight));
            ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
        };
        const drawKenBurnsFrame = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, progress: number, animation: string, canvasWidth: number, canvasHeight: number) => {
            ctx.save();
            const scale = animation.includes('in') ? 1 + progress * 0.1 : (animation.includes('out') ? 1.15 - progress * 0.15 : 1.2);
            let translateX = 0, translateY = 0;
            if (animation.includes('pan-right')) translateX = -5 + progress * 10;
            if (animation.includes('pan-left')) translateX = 5 - progress * 10;
            if (animation.includes('pan-up')) translateY = 5 - progress * 10;
            if (animation.includes('pan-down')) translateY = -5 + progress * 10;
            ctx.translate(canvasWidth * translateX / 100, canvasHeight * translateY / 100);
            const iw = image.width, ih = image.height;
            const canvasAspect = canvasWidth / canvasHeight, imageAspect = iw / ih;
            let sw, sh, sx, sy;
            if (imageAspect > canvasAspect) { sh = ih; sw = sh * canvasAspect; sx = (iw - sw) / 2; sy = 0; }
            else { sw = iw; sh = sw / canvasAspect; sy = (ih - sh) / 2; sx = 0; }
            ctx.drawImage(image, sx, sy, sw, sh, -(canvasWidth * (scale - 1)) / 2, -(canvasHeight * (scale - 1)) / 2, canvasWidth * scale, canvasHeight * scale);
            ctx.restore();
        }
        const canvas = canvasRef.current;
        if (!canvas) { setIsRendering(false); return; }
        const [w, h] = config.aspectRatio === '16:9' ? [1280, 720] : config.aspectRatio === '9:16' ? [720, 1280] : config.aspectRatio === '2.35:1' ? [1920, 817] : [1080, 1080];
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setIsRendering(false); return; }
        setRenderingMessage('Loading assets...');
        const images = await Promise.all(mediaAssets.map(asset => new Promise<HTMLImageElement>(resolve => {
            const img = new Image(); img.crossOrigin = "anonymous"; img.src = asset.url; img.onload = () => resolve(img);
        })));
        const watermarkImage = watermark ? await new Promise<HTMLImageElement>(resolve => {
            const img = new Image(); img.crossOrigin = "anonymous"; img.src = watermark; img.onload = () => resolve(img);
        }) : null;
        setRenderingMessage('Processing voiceovers...');
        const voiceoverOfflineContext = new OfflineAudioContext(1, Math.ceil(totalDuration * audioContext.sampleRate), audioContext.sampleRate);
        let currentAudioTime = 0;
        for (const segment of script) {
            const buffer = voiceovers.get(segment.id);
            if (buffer) {
                const source = voiceoverOfflineContext.createBufferSource(); source.buffer = buffer;
                source.connect(voiceoverOfflineContext.destination);
                source.start(currentAudioTime);
                currentAudioTime += buffer.duration;
            }
        }
        const voiceoverBuffer = await voiceoverOfflineContext.startRendering();
        let finalAudioBuffer: AudioBuffer;
        if (selectedMusic && musicBuffer) {
            setRenderingMessage('Mixing audio tracks...');
            const mixContext = new OfflineAudioContext(musicBuffer.numberOfChannels, voiceoverBuffer.length, audioContext.sampleRate);
            const voiceoverSource = mixContext.createBufferSource(); voiceoverSource.buffer = voiceoverBuffer;
            voiceoverSource.connect(mixContext.destination); voiceoverSource.start(0);
            const musicSource = mixContext.createBufferSource(); musicSource.buffer = musicBuffer; musicSource.loop = true;
            const musicGain = mixContext.createGain(); musicGain.gain.setValueAtTime(0.2, 0); 
            musicSource.connect(musicGain); musicGain.connect(mixContext.destination); musicSource.start(0);
            finalAudioBuffer = await mixContext.startRendering();
        } else finalAudioBuffer = voiceoverBuffer;
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        const audioSourceNode = audioContext.createBufferSource();
        audioSourceNode.buffer = finalAudioBuffer; audioSourceNode.connect(mediaStreamDestination);
        const combinedStream = new MediaStream([...canvas.captureStream(30).getVideoTracks(), ...mediaStreamDestination.stream.getAudioTracks()]);
        const recorder = new MediaRecorder(combinedStream, { mimeType: 'video/webm', videoBitsPerSecond: 8_000_000 });
        const chunks: Blob[] = [];
        recorder.ondataavailable = (e) => chunks.push(e.data);
        recorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            setDownloadUrl(URL.createObjectURL(blob));
            setIsRendering(false); setRenderingMessage('');
            try { audioSourceNode.stop(); audioSourceNode.disconnect(); } catch (e) {}
        };
        recorder.start(); audioSourceNode.start(0);
        const TRANSITION_DURATION = 0.5, startTime = performance.now();
        const renderLoop = (now: number) => {
            const elapsed = (now - startTime) / 1000;
            if (elapsed > totalDuration) {
                recorder.stop();
                if(renderFrameId.current) cancelAnimationFrame(renderFrameId.current);
                return;
            }
            setRenderingMessage(`Rendering video... ${Math.round((elapsed / totalDuration) * 100)}%`);
            let currentSceneIndex = 0, timeIntoScene = 0, timeSoFar = 0;
            for (let i = 0; i < segmentDurations.length; i++) {
                if (elapsed < timeSoFar + segmentDurations[i]) {
                    currentSceneIndex = i; timeIntoScene = elapsed - timeSoFar; break;
                } timeSoFar += segmentDurations[i];
            }
            ctx.fillStyle = "black"; ctx.fillRect(0, 0, w, h);
            const sceneDuration = segmentDurations[currentSceneIndex];
            const nextSceneIndex = (currentSceneIndex + 1);
            const animationProgress = sceneDuration > 0 ? timeIntoScene / sceneDuration : 1;
            const timeUntilEnd = sceneDuration - timeIntoScene;
            const isTransitioning = timeUntilEnd < TRANSITION_DURATION && nextSceneIndex < images.length;
            if (isTransitioning) {
                const transitionProgress = (TRANSITION_DURATION - timeUntilEnd) / TRANSITION_DURATION;
                ctx.globalAlpha = 1.0;
                drawKenBurnsFrame(ctx, images[currentSceneIndex], animationProgress, sceneAnimations[currentSceneIndex], w, h);
                ctx.globalAlpha = transitionProgress;
                drawKenBurnsFrame(ctx, images[nextSceneIndex], 0, sceneAnimations[nextSceneIndex], w, h);
            } else {
                 ctx.globalAlpha = 1.0;
                 drawKenBurnsFrame(ctx, images[currentSceneIndex], animationProgress, sceneAnimations[currentSceneIndex], w, h);
            }
            ctx.globalAlpha = 1.0;
            drawCaption(ctx, script[currentSceneIndex].narration, w, h);
            if (watermarkImage) {
                const margin = w * 0.02; const watermarkHeight = h * 0.05;
                const watermarkWidth = watermarkImage.width * (watermarkHeight / watermarkImage.height);
                ctx.globalAlpha = 0.8;
                ctx.drawImage(watermarkImage, w - watermarkWidth - margin, margin, watermarkWidth, watermarkHeight);
                ctx.globalAlpha = 1.0;
            }
            renderFrameId.current = requestAnimationFrame(renderLoop);
        };
        renderFrameId.current = requestAnimationFrame(renderLoop);
    }, [script, mediaAssets, voiceovers, audioContext, totalDuration, segmentDurations, config, isRendering, watermark, sceneAnimations, selectedMusic, musicBuffer]);

    const handleGenerateMetadata = useCallback(async () => {
        if (isMetadataLoading || !script || !theme) return;
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
    }, [script, theme, isMetadataLoading]);

    const handleCopyToClipboard = (text: string, id: string) => {
      navigator.clipboard.writeText(text);
      setCopiedStates(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setCopiedStates(prev => ({ ...prev, [id]: false }));
      }, 2000);
    };
    
    if (isRendering) return <Loader message={renderingMessage} />;

    const currentSegment = script[currentSegmentIndex];
    if (!currentSegment) return null;

    return (
        <div className="w-full max-w-5xl animate-fade-in-up">
             <canvas ref={canvasRef} className="hidden"></canvas>
             <div className="text-center mb-6">
                <h2 className="text-3xl md:text-4xl font-bold mt-1">Video for: "{theme}"</h2>
                <p className="text-gray-400 mt-2">Your AI-generated video is ready. Press play to watch or download.</p>
            </div>
            <div className="w-full" ref={fullscreenContainerRef}>
                <div className={`relative w-full mx-auto max-w-full ${aspectRatios[config.aspectRatio]} bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-800`}>
                    {mediaAssets.map((media, index) => (
                        <img key={media.segmentId} src={media.url} alt={media.description} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out animate-ken-burns"
                            style={{
                                animationName: isPlaying && currentSegmentIndex === index ? sceneAnimations[index] : 'none',
                                animationDuration: `${segmentDurations[index]}s`,
                                opacity: currentSegmentIndex === index ? 1 : 0,
                            }}
                        />
                    ))}
                    {watermark && (<img src={watermark} alt="Watermark" className="absolute top-4 right-4 h-[5%] w-auto opacity-80 pointer-events-none z-10" />)}
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-10"></div>
                    <div className="absolute inset-x-0 bottom-[15%] md:bottom-[20%] p-4 z-20" key={currentSegment.id}>
                        <p className="text-center text-white text-xl md:text-3xl font-black animate-fade-in drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                            {currentSegment.narration}
                        </p>
                    </div>
                </div>

                <div className="mt-4 w-full p-3 bg-gray-800/60 rounded-lg flex items-center gap-2 sm:gap-4 flex-wrap">
                    <button onClick={handleTogglePlay} className="p-2 bg-indigo-600 rounded-full text-white hover:bg-indigo-500 transition-colors disabled:bg-gray-600" disabled={isRendering}>
                        {isPlaying ? <PauseIcon className="w-6 h-6" /> : <PlayIcon className="w-6 h-6" />}
                    </button>
                    <span className="font-mono text-xs sm:text-sm text-gray-300">{formatTime(currentTime)}</span>
                    <div className="flex-grow h-2 bg-gray-600 rounded-full cursor-pointer group">
                       <div className="h-full bg-indigo-500 rounded-full group-hover:bg-indigo-400 transition-colors" style={{ width: `${progress}%` }}></div>
                    </div>
                    <span className="font-mono text-xs sm:text-sm text-gray-300">{formatTime(totalDuration)}</span>
                    <div className="w-full sm:w-auto flex justify-end gap-2 sm:gap-4 mt-2 sm:mt-0">
                        <button onClick={handleFullscreen} className="p-2 text-gray-300 hover:text-white transition-colors" title="Toggle Fullscreen"> <FullscreenIcon className="w-6 h-6" /> </button>
                        {downloadUrl ? (
                             <a href={downloadUrl} download={`${theme.replace(/\s+/g, '_')}.webm`} className="p-2 bg-green-600 rounded-full text-white hover:bg-green-500 transition-colors" title="Download Ready"> <DownloadIcon className="w-6 h-6"/> </a>
                        ) : (
                            <button onClick={handleDownload} className="p-2 bg-purple-600 rounded-full text-white hover:bg-purple-500 transition-colors disabled:bg-gray-600 disabled:animate-pulse" disabled={isRendering} title="Download Video"> <DownloadIcon className="w-6 h-6" /> </button>
                        )}
                    </div>
                </div>
                 {selectedMusic && (
                    <div className="mt-3 text-center text-sm text-gray-400 flex items-center justify-center gap-2 animate-fade-in">
                        <MusicNoteIcon className="w-4 h-4 text-purple-400" />
                        <span>Music: <span className="font-semibold text-gray-300">"{selectedMusic.title}" by {selectedMusic.artist}</span></span>
                        {musicLoadingState === 'loading' && <span className="text-xs italic">(Loading...)</span>}
                        {musicLoadingState === 'error' && <span className="text-xs italic text-red-400">(Failed to load)</span>}
                    </div>
                 )}
            </div>

            <div className="mt-16 w-full">
                <div className="text-center mb-8">
                    <h3 className="text-2xl md:text-3xl font-bold">Amplify Your Reach</h3>
                    <p className="text-gray-400 mt-2">Generate optimized content for your video to boost its discoverability.</p>
                </div>
                {!videoMetadata && !isMetadataLoading && (
                    <div className="text-center">
                        <button onClick={handleGenerateMetadata} disabled={isMetadataLoading} className="bg-purple-600 text-white font-semibold rounded-lg px-8 py-4 text-lg hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 disabled:bg-gray-700 disabled:cursor-not-allowed">
                            {isMetadataLoading ? 'Generating...' : '✨ Generate Video Details'}
                        </button>
                    </div>
                )}
                {isMetadataLoading && <Loader message="Crafting titles, descriptions, and more..." />}
                {videoMetadata && (
                    <div className="space-y-6 animate-fade-in-up">
                        {/* Title */}
                        <div>
                            <label className="text-lg font-semibold block mb-2">Title</label>
                            <div className="relative">
                                <p className="w-full bg-gray-800 rounded-md p-3 pr-12">{videoMetadata.title}</p>
                                <button onClick={() => handleCopyToClipboard(videoMetadata.title, 'title')} className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white transition-colors rounded-md">
                                    {copiedStates['title'] ? <CheckIcon className="w-5 h-5 text-green-500"/> : <ClipboardIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>
                        {/* Description */}
                        <div>
                            <label className="text-lg font-semibold block mb-2">Description</label>
                            <div className="relative">
                                <p className="w-full bg-gray-800 rounded-md p-3 pr-12 h-40 overflow-y-auto whitespace-pre-wrap">{videoMetadata.description}</p>
                                <button onClick={() => handleCopyToClipboard(videoMetadata.description, 'desc')} className="absolute right-2 top-3 p-2 text-gray-400 hover:text-white transition-colors rounded-md">
                                     {copiedStates['desc'] ? <CheckIcon className="w-5 h-5 text-green-500"/> : <ClipboardIcon className="w-5 h-5"/>}
                                </button>
                            </div>
                        </div>
                        {/* Chapters */}
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
                        {/* Tags */}
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

export default VideoPreview;
