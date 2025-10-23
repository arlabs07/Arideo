import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ScriptSegment, MediaAsset, VideoConfig, MusicSuggestion, MusicTrack, ChatMessage } from '../types';
import * as geminiService from '../services/geminiService';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { FullscreenIcon } from './icons/FullscreenIcon';
import { decode, decodeAudioData } from '../utils/audioUtils';
import Loader from './Loader';
import Chatbot from './Chatbot';

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
  onFinalize: (videoUrl: string, finalScript: ScriptSegment[]) => void;
  setScript: React.Dispatch<React.SetStateAction<ScriptSegment[] | null>>;
  setMediaAssets: React.Dispatch<React.SetStateAction<MediaAsset[] | null>>;
  setVoiceovers: React.Dispatch<React.SetStateAction<Map<string, AudioBuffer>>>;
  setSelectedMusic: React.Dispatch<React.SetStateAction<MusicTrack | null>>;
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

const VideoPreview: React.FC<VideoPreviewProps> = ({ 
    script, mediaAssets, voiceovers, audioContext, theme, config, watermark, selectedMusic, onFinalize,
    setScript, setMediaAssets, setVoiceovers, setSelectedMusic
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isRendering, setIsRendering] = useState(false);
    const [renderingMessage, setRenderingMessage] = useState('');
    const [musicBuffer, setMusicBuffer] = useState<AudioBuffer | null>(null);

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
        if (selectedMusic && selectedMusic.url) {
            const fetchMusic = async () => {
                try {
                    const response = await fetch(selectedMusic.url);
                    if (!response.ok) throw new Error(`Failed to fetch music: ${response.status} ${response.statusText}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const decodedBuffer = await audioContext.decodeAudioData(arrayBuffer);
                    setMusicBuffer(decodedBuffer);
                } catch (e) { 
                    console.error("Failed to load background music", e); 
                    setMusicBuffer(null);
                }
            };
            fetchMusic();
        } else {
            setMusicBuffer(null);
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

    const handleFinalizeAndRender = useCallback(async () => {
        if (isRendering) return;
        setIsRendering(true);
        
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

        const getWatermarkPositionAndOpacity = (elapsed: number, canvasWidth: number, canvasHeight: number, watermarkImage: HTMLImageElement) => {
            const period = 20; // seconds for one full loop
            const timeInPeriod = elapsed % period;
            const phaseDuration = period / 4;
            const phase = Math.floor(timeInPeriod / phaseDuration);
            const timeInPhase = timeInPeriod % phaseDuration;
    
            const margin = canvasWidth * 0.02;
            const watermarkHeight = canvasHeight * 0.05;
            const watermarkWidth = watermarkImage.width * (watermarkHeight / watermarkImage.height);
            
            const positions = [
                { x: canvasWidth - watermarkWidth - margin, y: margin }, // TR
                { x: margin, y: canvasHeight - watermarkHeight - margin }, // BL
                { x: margin, y: margin }, // TL
                { x: canvasWidth - watermarkWidth - margin, y: canvasHeight - watermarkHeight - margin }  // BR
            ];
            
            const currentPos = positions[phase];
            let opacity = 0.8;
            const fadeDuration = 0.25;
    
            if (timeInPhase > phaseDuration - fadeDuration) { // fading out
                opacity = 0.8 * (1 - (timeInPhase - (phaseDuration - fadeDuration)) / fadeDuration);
            } else if (timeInPhase < fadeDuration) { // fading in
                opacity = 0.8 * (timeInPhase / fadeDuration);
            }
            
            return { ...currentPos, opacity: Math.max(0, opacity) };
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
            const videoUrl = URL.createObjectURL(blob);
            setIsRendering(false); 
            setRenderingMessage('');
            try { audioSourceNode.stop(); audioSourceNode.disconnect(); } catch (e) {}
            onFinalize(videoUrl, script);
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
                const { x, y, opacity } = getWatermarkPositionAndOpacity(elapsed, w, h, watermarkImage);
                const watermarkHeight = h * 0.05;
                const watermarkWidth = watermarkImage.width * (watermarkHeight / watermarkImage.height);
                ctx.globalAlpha = opacity;
                ctx.drawImage(watermarkImage, x, y, watermarkWidth, watermarkHeight);
                ctx.globalAlpha = 1.0;
            }
            renderFrameId.current = requestAnimationFrame(renderLoop);
        };
        renderFrameId.current = requestAnimationFrame(renderLoop);
    }, [script, mediaAssets, voiceovers, audioContext, totalDuration, segmentDurations, config, isRendering, watermark, sceneAnimations, selectedMusic, musicBuffer, onFinalize]);

    if (isRendering) return <Loader message={renderingMessage} />;

    const currentSegment = script[currentSegmentIndex];
    if (!currentSegment) return null;

    const currentMediaAsset = mediaAssets.find(m => m.segmentId === currentSegment.id);

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in-up">
            <canvas ref={canvasRef} className="hidden"></canvas>
            <div className="text-center mb-6">
                <h2 className="text-3xl md:text-4xl font-bold mt-1 truncate" title={theme}>Customize Video: "{theme}"</h2>
                <p className="text-gray-400 mt-2">Use the chatbot to edit your video, then press play to preview.</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl shadow-2xl p-4 lg:p-6 flex flex-col lg:flex-row gap-6">
                <div className="flex-grow lg:w-[calc(66.66%-0.75rem)]">
                    <div className="w-full" ref={fullscreenContainerRef}>
                        <div className={`relative w-full mx-auto max-w-full ${aspectRatios[config.aspectRatio]} bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-800`}>
                            {mediaAssets.map((media, index) => {
                                const isActive = currentSegmentIndex === index;
                                return (
                                    <img key={media.segmentId} src={media.url} alt={media.description} className="absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out"
                                        style={{
                                            animation: isPlaying && isActive ? `${sceneAnimations[index]} ${segmentDurations[index]}s ease-in-out forwards` : 'none',
                                            opacity: isActive ? 1 : 0,
                                        }}
                                    />
                                );
                            })}

                            {watermark && (<img src={watermark} alt="Watermark" className="absolute h-[5%] w-auto pointer-events-none z-10" style={{ animation: `moveWatermark 20s linear infinite` }} />)}
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
                                <button 
                                    onClick={handleFinalizeAndRender} 
                                    className="p-2 bg-purple-600 rounded-full text-white hover:bg-purple-500 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed disabled:opacity-50" 
                                    disabled={isRendering} 
                                    title="Finalize & Render Video"
                                >
                                    <DownloadIcon className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex-shrink-0 lg:w-[calc(33.33%-0.75rem)]">
                     <Chatbot
                        script={script}
                        setScript={setScript}
                        setMediaAssets={setMediaAssets}
                        setVoiceovers={setVoiceovers}
                        audioContext={audioContext}
                        setSelectedMusic={setSelectedMusic}
                    />
                </div>
            </div>
        </div>
    );
};

export default VideoPreview;
