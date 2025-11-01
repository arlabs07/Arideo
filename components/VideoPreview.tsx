import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { ScriptSegment, MediaAsset, VideoConfig, MusicSuggestion, MusicTrack, ChatMessage, ScriptSegmentV2, SceneElement } from '../types';
import * as geminiService from '../services/geminiService';
import { PlayIcon } from './icons/PlayIcon';
import { PauseIcon } from './icons/PauseIcon';
import { DownloadIcon } from './icons/DownloadIcon';
import { FullscreenIcon } from './icons/FullscreenIcon';
import { decode, decodeAudioData } from '../utils/audioUtils';
import Loader from './Loader';
import Chatbot from './Chatbot';

interface VideoPreviewProps {
  script: ScriptSegment[] | null;
  scriptV2: ScriptSegmentV2[] | null;
  mediaAssets: MediaAsset[] | null;
  mediaAssetsV2: Map<string, string>;
  voiceovers: Map<string, AudioBuffer>;
  audioContext: AudioContext;
  onReset: () => void;
  theme: string;
  config: VideoConfig;
  watermark: string | null;
  musicSuggestion: MusicSuggestion | null;
  selectedMusic: MusicTrack | null;
  onFinalize: (videoUrl: string, finalScript: ScriptSegment[] | ScriptSegmentV2[]) => void;
  setScript: React.Dispatch<React.SetStateAction<ScriptSegment[] | null>>;
  setScriptV2: React.Dispatch<React.SetStateAction<ScriptSegmentV2[] | null>>;
  setMediaAssets: React.Dispatch<React.SetStateAction<MediaAsset[] | null>>;
  setVoiceovers: React.Dispatch<React.SetStateAction<Map<string, AudioBuffer>>>;
  setSelectedMusic: React.Dispatch<React.SetStateAction<MusicTrack | null>>;
  generationVersion: 'v1' | 'v2';
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

// V2 Rendering Helpers
const FADE_DURATION = 0.5;
const easeInOutCubic = (x: number): number => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;

const drawWrappedText = (ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, vAlign: SceneElement['style']['verticalAlign']) => {
    const words = text.split(' ');
    let line = '';
    const lines: string[] = [];

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        if (ctx.measureText(testLine).width > maxWidth && n > 0) {
            lines.push(line);
            line = words[n] + ' ';
        } else {
            line = testLine;
        }
    }
    lines.push(line);

    let startY = y;
    if (vAlign === 'middle') {
        startY = y - (lines.length - 1) * lineHeight / 2;
    } else if (vAlign === 'bottom') {
        startY = y - (lines.length - 1) * lineHeight;
    }

    lines.forEach((l, i) => {
        ctx.fillText(l.trim(), x, startY + i * lineHeight);
    });
};

const drawV2Frame = (
    ctx: CanvasRenderingContext2D,
    scene: ScriptSegmentV2,
    timeIntoScene: number,
    images: Map<string, HTMLImageElement>,
    voiceovers: Map<string, AudioBuffer>,
    nextScene: ScriptSegmentV2 | null,
    nextSceneTime: number
) => {
    const canvasWidth = ctx.canvas.width;
    const canvasHeight = ctx.canvas.height;
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    const drawScene = (targetScene: ScriptSegmentV2, time: number) => {
        targetScene.elements.forEach((element, elementIndex) => {
            const { animation, layout, style } = element;
            const animProgress = Math.max(0, Math.min(1, (time - animation.start) / animation.duration));

            if (animProgress <= 0) return;
            const easedProgress = easeInOutCubic(animProgress);
            
            ctx.save();

            const x = layout.x / 100 * canvasWidth;
            const y = layout.y / 100 * canvasHeight;
            const w = layout.width / 100 * canvasWidth;
            const h = layout.height / 100 * canvasHeight;
            
            let currentX = x, currentY = y;
            ctx.globalAlpha = 1.0;

            switch (animation.type) {
                case 'fade-in':
                    ctx.globalAlpha = easedProgress;
                    break;
                case 'slide-in-left':
                    currentX = x - (w * (1 - easedProgress));
                    break;
                case 'slide-in-right':
                    currentX = x + (w * (1 - easedProgress));
                    break;
                case 'slide-in-top':
                    currentY = y - (h * (1 - easedProgress));
                    break;
                case 'slide-in-bottom':
                    currentY = y + (h * (1 - easedProgress));
                    break;
            }

            if (element.type === 'image') {
                const img = images.get(element.id);
                if (img) {
                    ctx.save();
                    ctx.beginPath();
                    ctx.rect(currentX, currentY, w, h);
                    ctx.clip();
                    
                    let renderW, renderH, renderX, renderY;
                    const imgAspect = img.width / img.height;
                    const layoutAspect = w / h;
                    const isBackground = elementIndex === 0;

                    if (isBackground) { // Cover logic for background
                        if (imgAspect > layoutAspect) {
                            renderH = h; renderW = h * imgAspect;
                            renderX = currentX + (w - renderW) / 2; renderY = currentY;
                        } else {
                            renderW = w; renderH = w / imgAspect;
                            renderY = currentY + (h - renderH) / 2; renderX = currentX;
                        }
                    } else { // Contain logic for foreground images
                        if (imgAspect > layoutAspect) {
                            renderW = w; renderH = w / imgAspect;
                            renderX = currentX; renderY = currentY + (h - renderH) / 2;
                        } else {
                            renderH = h; renderW = h * imgAspect;
                            renderY = currentY; renderX = currentX + (w - renderW) / 2;
                        }
                    }
                    
                    if (animation.type === 'zoom-in') {
                        const scale = 1 + easedProgress * 0.10; // Slow zoom IN from 100% to 110%
                        const scaledW = renderW * scale;
                        const scaledH = renderH * scale;
                        const scaledX = renderX - (scaledW - renderW) / 2;
                        const scaledY = renderY - (scaledH - renderH) / 2;
                        ctx.drawImage(img, scaledX, scaledY, scaledW, scaledH);
                    } else {
                         ctx.drawImage(img, renderX, renderY, renderW, renderH);
                    }
                    ctx.restore(); // from clip
                }
            } else if (element.type === 'text' && element.text) {
                const fontSize = (style.fontSize || 5) / 100 * canvasHeight;
                ctx.font = `${style.fontWeight || '700'} ${fontSize}px ${style.fontFamily || 'Inter'}`;
                ctx.fillStyle = style.color || '#FFFFFF';
                ctx.textAlign = style.textAlign || 'center';
                ctx.textBaseline = 'middle';
                
                const textX = currentX + (style.textAlign === 'center' ? w / 2 : (style.textAlign === 'right' ? w : 0));
                const textY = currentY + h / 2;
                
                drawWrappedText(ctx, element.text, textX, textY, w, fontSize * 1.2, style.verticalAlign);
            }
            
            ctx.restore();
        });
    };

    const sceneDuration = voiceovers.get(scene.id)?.duration || 0;
    const timeUntilEnd = sceneDuration - timeIntoScene;

    if (nextScene && timeUntilEnd < FADE_DURATION) {
        const transitionProgress = (FADE_DURATION - timeUntilEnd) / FADE_DURATION;
        ctx.globalAlpha = 1.0 - transitionProgress;
        drawScene(scene, timeIntoScene);
        ctx.globalAlpha = transitionProgress;
        drawScene(nextScene, nextSceneTime);
        ctx.globalAlpha = 1.0;
    } else {
        drawScene(scene, timeIntoScene);
    }
};


const VideoPreview: React.FC<VideoPreviewProps> = ({ 
    script, scriptV2, mediaAssets, mediaAssetsV2, voiceovers, audioContext, theme, config, watermark, selectedMusic, onFinalize,
    setScript, setScriptV2, setMediaAssets, setVoiceovers, setSelectedMusic, generationVersion
}) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentSegmentIndex, setCurrentSegmentIndex] = useState(0);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [isRendering, setIsRendering] = useState(false);
    const [renderingMessage, setRenderingMessage] = useState('');
    const [musicBuffer, setMusicBuffer] = useState<AudioBuffer | null>(null);
    const [imagesV2, setImagesV2] = useState<Map<string, HTMLImageElement>>(new Map());

    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const musicSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const musicGainRef = useRef<GainNode | null>(null);
    const progressIntervalRef = useRef<number | null>(null);
    const v2_previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
    const renderFrameId = useRef<number | null>(null);
    const voiceoverSourcesRef = useRef<AudioBufferSourceNode[]>([]);
    
    const activeScript = useMemo(() => generationVersion === 'v1' ? script : scriptV2, [generationVersion, script, scriptV2]);
    const segmentDurations = useMemo(() => activeScript?.map(s => voiceovers.get(s.id)?.duration || 0) || [], [activeScript, voiceovers]);
    const totalDuration = useMemo(() => segmentDurations.reduce((acc, dur) => acc + dur, 0), [segmentDurations]);

    const sceneAnimations = useMemo(() => {
        return mediaAssets?.map((_, index) => animationClasses[(index * 3 + Math.floor(index / animationClasses.length)) % animationClasses.length]) || [];
    }, [mediaAssets]);

     useEffect(() => {
        if (generationVersion === 'v2' && mediaAssetsV2.size > 0) {
            const imagePromises: Promise<[string, HTMLImageElement]>[] = [];
            mediaAssetsV2.forEach((url, id) => {
                imagePromises.push(new Promise(resolve => {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = url;
                    img.onload = () => resolve([id, img]);
                }));
            });
            Promise.all(imagePromises).then(results => {
                setImagesV2(new Map(results));
            });
        }
    }, [generationVersion, mediaAssetsV2]);

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
        if (renderFrameId.current) {
            cancelAnimationFrame(renderFrameId.current);
            renderFrameId.current = null;
        }
        voiceoverSourcesRef.current.forEach(source => {
            try { source.stop(); } catch (e) {}
            source.disconnect();
        });
        voiceoverSourcesRef.current = [];
    }, []);
    
    useEffect(() => {
        if (!activeScript) return;
        
        if (generationVersion === 'v1') {
            let segmentTimeoutV1: number;
            const playSegmentV1 = (index: number) => {
                 if (audioSourceRef.current) {
                    try { audioSourceRef.current.stop(); } catch (e) {}
                    audioSourceRef.current.disconnect();
                }
                if (index >= activeScript.length) {
                    setIsPlaying(false);
                    return;
                }
                setCurrentSegmentIndex(index);
                const segment = activeScript[index];
                const voiceover = voiceovers.get(segment.id);
                const duration = voiceover?.duration || 0;
                
                if (voiceover && isPlaying) {
                    const source = audioContext.createBufferSource();
                    source.buffer = voiceover;
                    source.connect(audioContext.destination);
                    source.start();
                    audioSourceRef.current = source;
                    segmentTimeoutV1 = window.setTimeout(() => { if (isPlaying) playSegmentV1(index + 1); }, duration * 1000);
                }
            };

            if (isPlaying) {
                if (audioContext.state === 'suspended') audioContext.resume();

                if (musicBuffer && !musicSourceRef.current) {
                    const gainNode = audioContext.createGain();
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                    gainNode.connect(audioContext.destination);
                    musicGainRef.current = gainNode;
                    const source = audioContext.createBufferSource();
                    source.buffer = musicBuffer;
                    source.loop = true;
                    source.connect(gainNode);
                    source.start(0, currentTime);
                    musicSourceRef.current = source;
                }
                
                const timeElapsedSoFar = segmentDurations.slice(0, currentSegmentIndex).reduce((acc, dur) => acc + dur, 0);
                const startTime = Date.now();
                if(progressIntervalRef.current) clearInterval(progressIntervalRef.current);
                progressIntervalRef.current = window.setInterval(() => {
                    const elapsed = (Date.now() - startTime) / 1000;
                    const newCurrentTime = timeElapsedSoFar + elapsed;
                    if (newCurrentTime <= totalDuration) {
                        setCurrentTime(newCurrentTime);
                        setProgress((newCurrentTime / totalDuration) * 100);
                    } else {
                        setCurrentTime(totalDuration);
                        setProgress(100);
                    }
                }, 100);

                playSegmentV1(currentSegmentIndex);
            } else {
                 cleanupPlayback();
                 clearTimeout(segmentTimeoutV1);
            }
            return () => {
                cleanupPlayback();
                clearTimeout(segmentTimeoutV1);
            };

        } else if (generationVersion === 'v2') {
             if (isPlaying) {
                if (audioContext.state === 'suspended') audioContext.resume();
                
                const playbackStartTime = performance.now() - currentTime * 1000;

                // Start Music
                if (musicBuffer && !musicSourceRef.current) {
                    const gainNode = audioContext.createGain();
                    gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
                    gainNode.connect(audioContext.destination);
                    musicGainRef.current = gainNode;
                    const musicSrc = audioContext.createBufferSource();
                    musicSrc.buffer = musicBuffer;
                    musicSrc.loop = true;
                    musicSrc.connect(gainNode);
                    musicSrc.start(0, currentTime % musicBuffer.duration);
                    musicSourceRef.current = musicSrc;
                }

                // Schedule all voiceovers
                let timeSoFar = 0;
                scriptV2?.forEach(scene => {
                    const voiceover = voiceovers.get(scene.id);
                    if (voiceover && timeSoFar >= currentTime) {
                        const source = audioContext.createBufferSource();
                        source.buffer = voiceover;
                        source.connect(audioContext.destination);
                        source.start(audioContext.currentTime + (timeSoFar - currentTime));
                        voiceoverSourcesRef.current.push(source);
                    }
                    timeSoFar += voiceover?.duration || 0;
                });
                
                const renderLoop = (now: number) => {
                    const elapsed = (now - playbackStartTime) / 1000;
                    if (elapsed >= totalDuration) {
                        setIsPlaying(false);
                        setCurrentTime(totalDuration);
                        setProgress(100);
                        return;
                    }

                    setCurrentTime(elapsed);
                    setProgress((elapsed / totalDuration) * 100);

                    let currentSceneIdx = 0;
                    let timeIntoScene = 0;
                    let sceneStartTime = 0;
                    for (let i = 0; i < segmentDurations.length; i++) {
                        if (elapsed < sceneStartTime + segmentDurations[i]) {
                            currentSceneIdx = i; timeIntoScene = elapsed - sceneStartTime; break;
                        } sceneStartTime += segmentDurations[i];
                    }
                    setCurrentSegmentIndex(currentSceneIdx);
                    
                    const canvas = v2_previewCanvasRef.current;
                    const ctx = canvas?.getContext('2d');
                    if (ctx && scriptV2) {
                        const currentScene = scriptV2[currentSceneIdx];
                        const nextScene = currentSceneIdx + 1 < scriptV2.length ? scriptV2[currentSceneIdx + 1] : null;
                        drawV2Frame(ctx, currentScene, timeIntoScene, imagesV2, voiceovers, nextScene, 0);
                        // Add master fade in/out
                        ctx.save();
                        if (elapsed < FADE_DURATION) {
                            ctx.globalAlpha = 1.0 - (elapsed / FADE_DURATION);
                            ctx.fillStyle = 'black';
                            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                        } else if (totalDuration - elapsed < FADE_DURATION) {
                            ctx.globalAlpha = (elapsed - (totalDuration - FADE_DURATION)) / FADE_DURATION;
                             ctx.fillStyle = 'black';
                            ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                        }
                        ctx.restore();
                    }
                    
                    renderFrameId.current = requestAnimationFrame(renderLoop);
                };
                renderFrameId.current = requestAnimationFrame(renderLoop);
            } else {
                cleanupPlayback();
            }

            return () => {
                cleanupPlayback();
            };
        }
    }, [isPlaying, audioContext, generationVersion]);


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
        if (isRendering || !activeScript) return;
        setIsRendering(true);

        const canvas = document.createElement('canvas');
        if (!canvas) { setIsRendering(false); return; }
        const [w, h] = config.aspectRatio === '16:9' ? [1280, 720] : config.aspectRatio === '9:16' ? [720, 1280] : config.aspectRatio === '2.35:1' ? [1920, 817] : [1080, 1080];
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setIsRendering(false); return; }
        
        setRenderingMessage('Processing voiceovers...');
        const voiceoverOfflineContext = new OfflineAudioContext(1, Math.ceil(totalDuration * audioContext.sampleRate), audioContext.sampleRate);
        let currentAudioTime = 0;
        for (const segment of activeScript) {
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
            onFinalize(videoUrl, activeScript);
        };
        recorder.start(); audioSourceNode.start(0);
        
        const startTime = performance.now();
        let frameRenderLoop: ((now: number) => void);

        if (generationVersion === 'v1' && script && mediaAssets) {
            setRenderingMessage('Loading assets...');
            const images = await Promise.all(mediaAssets.map(asset => new Promise<HTMLImageElement>(resolve => {
                const img = new Image(); img.crossOrigin = "anonymous"; img.src = asset.url; img.onload = () => resolve(img);
            })));
            const watermarkImage = watermark ? await new Promise<HTMLImageElement>(resolve => {
                const img = new Image(); img.crossOrigin = "anonymous"; img.src = watermark; img.onload = () => resolve(img);
            }) : null;

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
                const period = 20; const timeInPeriod = elapsed % period; const phaseDuration = period / 4;
                const phase = Math.floor(timeInPeriod / phaseDuration); const timeInPhase = timeInPeriod % phaseDuration;
                const margin = canvasWidth * 0.02; const watermarkHeight = canvasHeight * 0.05;
                const watermarkWidth = watermarkImage.width * (watermarkHeight / watermarkImage.height);
                const positions = [ { x: canvasWidth - watermarkWidth - margin, y: margin }, { x: margin, y: canvasHeight - watermarkHeight - margin }, { x: margin, y: margin }, { x: canvasWidth - watermarkWidth - margin, y: canvasHeight - watermarkHeight - margin }];
                const currentPos = positions[phase]; let opacity = 0.8; const fadeDuration = 0.25;
                if (timeInPhase > phaseDuration - fadeDuration) { opacity = 0.8 * (1 - (timeInPhase - (phaseDuration - fadeDuration)) / fadeDuration); } else if (timeInPhase < fadeDuration) { opacity = 0.8 * (timeInPhase / fadeDuration); }
                return { ...currentPos, opacity: Math.max(0, opacity) };
            };
            const drawKenBurnsFrame = (ctx: CanvasRenderingContext2D, image: HTMLImageElement, progress: number, animation: string, canvasWidth: number, canvasHeight: number) => {
                ctx.save();
                const scale = animation.includes('in') ? 1 + progress * 0.1 : (animation.includes('out') ? 1.15 - progress * 0.15 : 1.2);
                let translateX = 0, translateY = 0;
                if (animation.includes('pan-right')) translateX = -5 + progress * 10; if (animation.includes('pan-left')) translateX = 5 - progress * 10;
                if (animation.includes('pan-up')) translateY = 5 - progress * 10; if (animation.includes('pan-down')) translateY = -5 + progress * 10;
                ctx.translate(canvasWidth * translateX / 100, canvasHeight * translateY / 100);
                const iw = image.width, ih = image.height; const canvasAspect = canvasWidth / canvasHeight, imageAspect = iw / ih;
                let sw, sh, sx, sy;
                if (imageAspect > canvasAspect) { sh = ih; sw = sh * canvasAspect; sx = (iw - sw) / 2; sy = 0; } else { sw = iw; sh = sw / canvasAspect; sy = (ih - sh) / 2; sx = 0; }
                ctx.drawImage(image, sx, sy, sw, sh, -(canvasWidth * (scale - 1)) / 2, -(canvasHeight * (scale - 1)) / 2, canvasWidth * scale, canvasHeight * scale);
                ctx.restore();
            }
            const TRANSITION_DURATION = 0.5;
            frameRenderLoop = (now: number) => {
                const elapsed = (now - startTime) / 1000;
                if (elapsed > totalDuration) { recorder.stop(); if(renderFrameId.current) cancelAnimationFrame(renderFrameId.current); return; }
                setRenderingMessage(`Rendering video... ${Math.round((elapsed / totalDuration) * 100)}%`);
                let currentSceneIndex = 0, timeIntoScene = 0, timeSoFar = 0;
                for (let i = 0; i < segmentDurations.length; i++) { if (elapsed < timeSoFar + segmentDurations[i]) { currentSceneIndex = i; timeIntoScene = elapsed - timeSoFar; break; } timeSoFar += segmentDurations[i]; }
                ctx.fillStyle = "black"; ctx.fillRect(0, 0, w, h);
                const sceneDuration = segmentDurations[currentSceneIndex];
                const nextSceneIndex = (currentSceneIndex + 1);
                const animationProgress = sceneDuration > 0 ? timeIntoScene / sceneDuration : 1;
                const timeUntilEnd = sceneDuration - timeIntoScene;
                const isTransitioning = timeUntilEnd < TRANSITION_DURATION && nextSceneIndex < images.length;
                if (isTransitioning) {
                    const transitionProgress = (TRANSITION_DURATION - timeUntilEnd) / TRANSITION_DURATION;
                    ctx.globalAlpha = 1.0; drawKenBurnsFrame(ctx, images[currentSceneIndex], animationProgress, sceneAnimations[currentSceneIndex], w, h);
                    ctx.globalAlpha = transitionProgress; drawKenBurnsFrame(ctx, images[nextSceneIndex], 0, sceneAnimations[nextSceneIndex], w, h);
                } else { ctx.globalAlpha = 1.0; drawKenBurnsFrame(ctx, images[currentSceneIndex], animationProgress, sceneAnimations[currentSceneIndex], w, h); }
                ctx.globalAlpha = 1.0; drawCaption(ctx, script[currentSceneIndex].narration, w, h);
                if (watermarkImage) {
                    const { x, y, opacity } = getWatermarkPositionAndOpacity(elapsed, w, h, watermarkImage);
                    const watermarkHeight = h * 0.05; const watermarkWidth = watermarkImage.width * (watermarkHeight / watermarkImage.height);
                    ctx.globalAlpha = opacity; ctx.drawImage(watermarkImage, x, y, watermarkWidth, watermarkHeight); ctx.globalAlpha = 1.0;
                }
                renderFrameId.current = requestAnimationFrame(frameRenderLoop);
            };
        } else if (generationVersion === 'v2' && scriptV2) {
             frameRenderLoop = (now: number) => {
                const elapsed = (now - startTime) / 1000;
                if (elapsed >= totalDuration) { recorder.stop(); if(renderFrameId.current) cancelAnimationFrame(renderFrameId.current); return; }
                setRenderingMessage(`Rendering video... ${Math.round((elapsed / totalDuration) * 100)}%`);
                let currentSceneIndex = 0, timeIntoScene = 0, timeSoFar = 0;
                for (let i = 0; i < segmentDurations.length; i++) { if (elapsed < timeSoFar + segmentDurations[i]) { currentSceneIndex = i; timeIntoScene = elapsed - timeSoFar; break; } timeSoFar += segmentDurations[i]; }
                
                const currentScene = scriptV2[currentSceneIndex];
                const nextScene = currentSceneIndex + 1 < scriptV2.length ? scriptV2[currentSceneIndex + 1] : null;

                drawV2Frame(ctx, currentScene, timeIntoScene, imagesV2, voiceovers, nextScene, 0);

                // Add master fade in/out
                ctx.save();
                if (elapsed < FADE_DURATION) {
                    ctx.globalAlpha = 1.0 - (elapsed / FADE_DURATION);
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, w, h);
                } else if (totalDuration - elapsed < FADE_DURATION) {
                    ctx.globalAlpha = (elapsed - (totalDuration - FADE_DURATION)) / FADE_DURATION;
                    ctx.fillStyle = 'black';
                    ctx.fillRect(0, 0, w, h);
                }
                ctx.restore();


                renderFrameId.current = requestAnimationFrame(frameRenderLoop);
            };
        } else {
             setIsRendering(false);
             return;
        }

        renderFrameId.current = requestAnimationFrame(frameRenderLoop);
    }, [activeScript, voiceovers, audioContext, totalDuration, segmentDurations, config, isRendering, watermark, sceneAnimations, selectedMusic, musicBuffer, onFinalize, generationVersion, script, mediaAssets, scriptV2, imagesV2]);

    if (isRendering) return <Loader message={renderingMessage} />;

    const currentSegment = activeScript?.[currentSegmentIndex];
    if (!currentSegment) return null;

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in-up">
            <div className="text-center mb-6">
                <h2 className="text-3xl md:text-4xl font-bold mt-1 truncate" title={theme}>Customize Video: "{theme}"</h2>
                <p className="text-gray-400 mt-2">Use the chatbot to edit your video, then press play to preview.</p>
            </div>
            <div className="bg-gray-900/30 border border-gray-800 rounded-2xl shadow-2xl p-4 lg:p-6 flex flex-col lg:flex-row gap-6">
                <div className="flex-grow lg:w-[calc(66.66%-0.75rem)]">
                    <div className="w-full" ref={fullscreenContainerRef}>
                        <div className={`relative w-full mx-auto max-w-full ${aspectRatios[config.aspectRatio]} bg-black rounded-lg overflow-hidden shadow-2xl border-2 border-gray-800`}>
                            {generationVersion === 'v1' && mediaAssets && (
                                <>
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
                                </>
                            )}
                             {generationVersion === 'v2' && (
                                <canvas ref={v2_previewCanvasRef} className="w-full h-full" width={config.aspectRatio === '9:16' ? 720 : 1280} height={config.aspectRatio === '9:16' ? 1280 : 720} />
                            )}
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
                        script={activeScript}
                        setScript={setScript}
                        setScriptV2={setScriptV2}
                        setMediaAssets={setMediaAssets}
                        setVoiceovers={setVoiceovers}
                        audioContext={audioContext}
                        setSelectedMusic={setSelectedMusic}
                        generationVersion={generationVersion}
                    />
                </div>
            </div>
        </div>
    );
};

export default VideoPreview;