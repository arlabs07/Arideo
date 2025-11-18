import React, { useState, useCallback, useMemo, useRef } from 'react';
import { ScriptSegment, MediaAsset, VideoConfig, MusicSuggestion, MusicTrack, VideoMetadata, ScriptSegmentV2, SceneElement } from './types';
import * as geminiService from './services/geminiService';
import { decodeAudioData, decode } from './utils/audioUtils';
import PromptInput from './components/PromptInput';
import Overlay from './components/Overlay';
import ScriptDisplay from './components/ScriptDisplay';
import VideoPreview from './components/VideoPreview';
import Loader from './components/Loader';
import ResearchDisplay from './components/ResearchDisplay';
import { ArideoLogo } from './ArideoLogo';
import DownloadPage from './components/DownloadPage';

type AppView = 'prompt' | 'generating' | 'download';
type AppStep = 'theme' | 'research' | 'script' | 'preview';

async function processInBatches<T>(
  tasks: (() => Promise<T>)[],
  initialBatchSize: number,
  onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
  // Create a queue of tasks with their original indices
  let taskQueue = tasks.map((task, index) => ({ task, index }));
  const results: Array<T | undefined> = new Array(tasks.length).fill(undefined);
  
  let batchSize = initialBatchSize;
  let failureCount = 0;
  const FAILURE_THRESHOLD = 3;

  while (taskQueue.length > 0) {
    const batch = taskQueue.splice(0, batchSize);
    
    const outcomes = await Promise.allSettled(batch.map(item => item.task()));

    const failedInBatch: typeof batch = [];

    outcomes.forEach((outcome, i) => {
      const taskItem = batch[i];
      if (outcome.status === 'fulfilled') {
        results[taskItem.index] = outcome.value;
      } else {
        console.warn(`Task at index ${taskItem.index} failed:`, outcome.reason);
        failureCount++;
        failedInBatch.push(taskItem);
      }
    });

    const completedSoFar = results.filter(r => r !== undefined).length;
    if (onProgress) {
      onProgress(completedSoFar, tasks.length);
    }
    
    if (failedInBatch.length > 0) {
      // Put failed tasks back at the front of the queue to be retried
      taskQueue.unshift(...failedInBatch);

      if (failureCount >= FAILURE_THRESHOLD && batchSize > 1) {
        console.log(`Switching to serial processing (batch size 1) after ${failureCount} failures.`);
        batchSize = 1;
      }
      // Delay before next attempt to avoid hammering the API
      await new Promise(resolve => setTimeout(resolve, 1500));
    }
  }
  
  if (results.some(r => r === undefined)) {
      // This path is taken if a task fails all its internal retries and we decide not to retry at this level infinitely.
      // Since we are retrying for now, this error is for robustness.
      throw new Error("Could not complete all tasks. Some tasks may have failed permanently.");
  }

  return results as T[];
}

const AppStepper: React.FC<{ currentStep: AppStep }> = ({ currentStep }) => {
    const steps: AppStep[] = ['research', 'script', 'preview'];
    const stepNames: Record<Exclude<AppStep, 'theme'>, string> = {
        research: 'Research',
        script: 'Script',
        preview: 'Customize'
    };

    const currentStepIndex = steps.indexOf(currentStep);

    return (
        <div className="w-full max-w-2xl mx-auto mb-8 animate-fade-in">
            <div className="flex items-center">
                {steps.map((step, index) => {
                    const isCompleted = currentStepIndex > index;
                    const isActive = currentStepIndex === index;

                    return (
                        <React.Fragment key={step}>
                            <div className="flex flex-col items-center text-center w-24">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${isCompleted ? 'bg-indigo-600 border-indigo-500' : isActive ? 'border-indigo-500 shadow-lg shadow-indigo-500/30' : 'bg-gray-800 border-gray-700'}`}>
                                    {isCompleted ? <span className="material-symbols-outlined text-white">check</span> : <span className={`font-bold text-lg ${isActive ? 'text-indigo-400' : 'text-gray-500'}`}>{index + 1}</span>}
                                </div>
                                <p className={`mt-2 text-xs font-semibold tracking-wider uppercase ${isActive || isCompleted ? 'text-white' : 'text-gray-500'}`}>{stepNames[step as Exclude<AppStep, 'theme'>]}</p>
                            </div>
                            {index < steps.length - 1 && 
                                <div className="flex-1 h-1 bg-gray-700 relative">
                                    <div 
                                        className="absolute top-0 left-0 h-full bg-indigo-600 transition-transform duration-500 ease-in-out" 
                                        style={{ transform: isCompleted ? 'scaleX(1)' : 'scaleX(0)', transformOrigin: 'left' }}
                                    ></div>
                                </div>
                            }
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};

function App() {
  const [theme, setTheme] = useState<string>('');
  const [videoConfig, setVideoConfig] = useState<VideoConfig | null>(null);
  const [researchData, setResearchData] = useState<geminiService.ResearchResult | null>(null);
  const [script, setScript] = useState<ScriptSegment[] | null>(null);
  const [scriptV2, setScriptV2] = useState<ScriptSegmentV2[] | null>(null);
  const [musicSuggestion, setMusicSuggestion] = useState<MusicSuggestion | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[] | null>(null);
  const [mediaAssetsV2, setMediaAssetsV2] = useState<Map<string, string>>(new Map());
  const [voiceovers, setVoiceovers] = useState<Map<string, AudioBuffer>>(new Map());
  const [watermark, setWatermark] = useState<string | null>(null);
  const [initialImageAsset, setInitialImageAsset] = useState<string | null>(null);
  
  const [appView, setAppView] = useState<AppView>('prompt');
  const [currentStep, setCurrentStep] = useState<AppStep>('theme');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [activeOverlay, setActiveOverlay] = useState<string | null>(null);

  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);
  const [finalScript, setFinalScript] = useState<ScriptSegment[] | null>(null);
  const [finalScriptV2, setFinalScriptV2] = useState<ScriptSegmentV2[] | null>(null);
  
  const [generationVersion, setGenerationVersion] = useState<'v1' | 'v2'>('v1');

  const audioContext = useMemo(() => new (window.AudioContext || (window as any).webkitAudioContext)(), []);

  const handleReset = () => {
    setTheme('');
    setVideoConfig(null);
    setResearchData(null);
    setScript(null);
    setScriptV2(null);
    setMusicSuggestion(null);
    setSelectedMusic(null);
    setMediaAssets(null);
    setMediaAssetsV2(new Map());
    setVoiceovers(new Map());
    setFinalVideoUrl(null);
    setFinalScript(null);
    setFinalScriptV2(null);
    setCurrentStep('theme');
    setError(null);
    setIsLoading(false);
    setWatermark(null);
    setInitialImageAsset(null);
    setAppView('prompt');
    setGenerationVersion('v1');
  };

  const handleResearch = useCallback(async (newTheme: string, config: VideoConfig) => {
    setTheme(newTheme);
    setVideoConfig(config);
    setIsLoading(true);
    setLoadingMessage('Conducting deep research on your theme...');
    setError(null);
    setResearchData(null);
    setCurrentStep('research');

    try {
        const result = await geminiService.conductResearch(newTheme);
        setResearchData(result);
    } catch (e) {
        console.error('Research failed:', e);
        setError(`Failed to conduct research. ${e instanceof Error ? e.message : 'Please try again.'}`);
        handleReset();
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleGenerateFromPrompt = async (prompt: string, newWatermark: string | null, userImage: string | null) => {
    setIsLoading(true);
    setError(null);
    setLoadingMessage("Understanding your video idea...");
    setAppView('generating');
    setCurrentStep('theme');
    
    try {
      const { theme: parsedTheme, ...parsedConfig } = await geminiService.parsePromptForConfig(prompt);
      setWatermark(newWatermark);
      setInitialImageAsset(userImage);
      await handleResearch(parsedTheme, parsedConfig);
    } catch (e) {
        console.error('Prompt parsing or generation failed:', e);
        setError(e instanceof Error ? e.message : 'Could not understand your prompt. Please be more specific.');
        setAppView('prompt');
        setIsLoading(false);
    }
  };
  
  const handleGenerateFromCustomScript = useCallback(async (scriptText: string, config: VideoConfig, newWatermark: string | null) => {
    setGenerationVersion('v1');
    setTheme("Custom Script");
    setVideoConfig(config);
    setWatermark(newWatermark);

    setIsLoading(true);
    setError(null);
    setAppView('generating');
    setCurrentStep('script');
    setLoadingMessage("Parsing your custom script...");

    try {
        const parsedScript = await geminiService.parseUserScript(scriptText);
        const scriptWithIds = parsedScript.map((segment, index) => ({
            ...segment,
            id: `segment-${index}-${Date.now()}`,
        }));
        setScript(scriptWithIds);

        setLoadingMessage('Analyzing tone for background music...');
        const fullNarration = scriptWithIds.map(s => s.narration).join('\n');
        const suggestion = await geminiService.generateMusicSuggestion(fullNarration);
        setMusicSuggestion(suggestion);

        setLoadingMessage('Preparing video generation...');
        setMediaAssets(null);
        setVoiceovers(new Map());
        setSelectedMusic(null);
        setCurrentStep('preview');

        setLoadingMessage('Selecting background music...');
        const musicTrack = await geminiService.selectMusicTrack("Custom Script", suggestion);
        setSelectedMusic(musicTrack);

        const CONCURRENCY_LIMIT = 5;

        setLoadingMessage(`Generating ${scriptWithIds.length} visuals... (0/${scriptWithIds.length})`);
        const visualTasks = scriptWithIds.map(segment => () => geminiService.generateVisual(segment.visuals.trim()));
        const visualUrls = await processInBatches(visualTasks, CONCURRENCY_LIMIT, (completed, total) => {
            setLoadingMessage(`Generating ${total} visuals... (${completed}/${total})`);
        });
        
        setLoadingMessage(`Synthesizing ${scriptWithIds.length} voiceovers... (0/${scriptWithIds.length})`);
        const voiceoverTasks = scriptWithIds.map(segment => () => geminiService.generateVoiceover(segment.narration, segment.voice || 'Puck'));
        const voiceoverB64s = await processInBatches(voiceoverTasks, CONCURRENCY_LIMIT, (completed, total) => {
            setLoadingMessage(`Synthesizing ${total} voiceovers... (${completed}/${total})`);
        });

        setLoadingMessage('Decoding audio...');
        const decodedVoiceoverPromises = voiceoverB64s.map(audioB64 => {
            const decodedAudio = decode(audioB64);
            return decodeAudioData(decodedAudio, audioContext, 24000, 1);
        });
        const audioBuffers = await Promise.all(decodedVoiceoverPromises);
        
        const newMediaAssets = scriptWithIds.map((segment, index) => ({
            segmentId: segment.id,
            type: 'image' as const,
            url: visualUrls[index],
            description: segment.visuals.trim()
        }));

        const newVoiceovers = new Map<string, AudioBuffer>();
        scriptWithIds.forEach((segment, index) => {
            newVoiceovers.set(segment.id, audioBuffers[index]);
        });

        setMediaAssets(newMediaAssets);
        setVoiceovers(newVoiceovers);

    } catch (e) {
        console.error('Custom script generation failed:', e);
        setError(e instanceof Error ? e.message : 'Could not process your script. Please check the formatting.');
        handleReset();
    } finally {
        setIsLoading(false);
    }
  }, [audioContext, handleReset]);


  const handleGenerateFromOverlay = (
    data: { type: 'prompt', prompt: string } | { type: 'script', scriptText: string, config: VideoConfig },
    newWatermark: string | null
  ) => {
      setActiveOverlay(null);
      if (data.type === 'script') {
          handleGenerateFromCustomScript(data.scriptText, data.config, newWatermark);
      } else {
          handleGenerateFromPrompt(data.prompt, newWatermark, null);
      }
  };

  const handleScriptGenerationV1 = useCallback(async () => {
    if (!theme || !videoConfig || !researchData) return;

    setIsLoading(true);
    setLoadingMessage('Generating professional script from research...');
    setError(null);
    setScript(null);
    setMusicSuggestion(null);
    setCurrentStep('script');

    try {
      const generatedScript = await geminiService.generateScript(theme, videoConfig, researchData.summary);
      const scriptWithIds = generatedScript.map((segment, index) => ({
        ...segment,
        id: `segment-${index}-${Date.now()}`,
      }));
      setScript(scriptWithIds);

      setLoadingMessage('Analyzing tone for background music...');
      const fullNarration = scriptWithIds.map(s => s.narration).join('\n');
      const suggestion = await geminiService.generateMusicSuggestion(fullNarration);
      setMusicSuggestion(suggestion);

    } catch (e) {
      console.error('Script generation failed:', e);
      setError('Failed to generate script. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [theme, videoConfig, researchData]);

  const handleGenerationV2 = useCallback(async () => {
    if (!theme || !videoConfig || !researchData) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
        setCurrentStep('script');
        setLoadingMessage('Designing animated scenes (V2)...');
        const generatedScriptV2 = await geminiService.generateScriptV2(theme, videoConfig, researchData.summary);
        setScriptV2(generatedScriptV2);

        setLoadingMessage('Analyzing tone for background music...');
        const fullNarration = generatedScriptV2.map(s => s.narration).join('\n');
        const suggestion = await geminiService.generateMusicSuggestion(fullNarration);
        setMusicSuggestion(suggestion);

        setLoadingMessage('Selecting background music...');
        const musicTrack = await geminiService.selectMusicTrack(theme, suggestion);
        setSelectedMusic(musicTrack);

        const imageElements = generatedScriptV2.flatMap(scene =>
            scene.elements.filter(e => e.type === 'image' && e.prompt).map(element => ({ sceneId: scene.id, element }))
        );

        const CONCURRENCY_LIMIT = 5;

        setLoadingMessage(`Generating ${imageElements.length} visual assets... (0/${imageElements.length})`);
        const visualTasks = imageElements.map(({ element }) => () => geminiService.generateVisual(element.prompt!));
        const visualUrls = await processInBatches(visualTasks, CONCURRENCY_LIMIT, (completed, total) => {
            setLoadingMessage(`Generating ${total} visual assets... (${completed}/${total})`);
        });
        
        const newMediaAssetsV2 = new Map<string, string>();
        imageElements.forEach(({ element }, index) => {
            newMediaAssetsV2.set(element.id, visualUrls[index]);
        });
        
        setLoadingMessage(`Synthesizing ${generatedScriptV2.length} voiceovers... (0/${generatedScriptV2.length})`);
        const voiceoverTasks = generatedScriptV2.map(scene => () => geminiService.generateVoiceover(scene.narration, scene.voice || 'Puck'));
        const voiceoverB64s = await processInBatches(voiceoverTasks, CONCURRENCY_LIMIT, (completed, total) => {
            setLoadingMessage(`Synthesizing ${total} voiceovers... (${completed}/${total})`);
        });
        
        setLoadingMessage('Decoding audio...');
        const decodedVoiceoverPromises = voiceoverB64s.map(audioB64 => {
            const decodedAudio = decode(audioB64);
            return decodeAudioData(decodedAudio, audioContext, 24000, 1);
        });
        const audioBuffers = await Promise.all(decodedVoiceoverPromises);
        
        const newVoiceovers = new Map<string, AudioBuffer>();
        generatedScriptV2.forEach((scene, index) => {
            newVoiceovers.set(scene.id, audioBuffers[index]);
        });

        setMediaAssetsV2(newMediaAssetsV2);
        setVoiceovers(newVoiceovers);
        setCurrentStep('preview');

    } catch (e) {
        console.error('V2 generation failed:', e);
        setError(`V2 generation failed. ${e instanceof Error ? e.message : 'Please try again.'}`);
    } finally {
        setIsLoading(false);
    }
}, [theme, videoConfig, researchData, audioContext]);

  const handleContinueFromResearch = useCallback(async () => {
    if (generationVersion === 'v1') {
        await handleScriptGenerationV1();
    } else {
        await handleGenerationV2();
    }
  }, [generationVersion, handleScriptGenerationV1, handleGenerationV2]);


  const handleScriptChange = useCallback((index: number, field: 'narration' | 'visuals', value: string) => {
    setScript(prevScript => {
      if (!prevScript) return null;
      const newScript = [...prevScript];
      newScript[index] = { ...newScript[index], [field]: value };
      return newScript;
    });
  }, []);

  const handlePreviewGenerationV1 = useCallback(async () => {
    if (!script || !theme || !musicSuggestion || !videoConfig) return;

    setIsLoading(true);
    setLoadingMessage('Preparing video generation...');
    setError(null);
    setMediaAssets(null);
    setVoiceovers(new Map());
    setSelectedMusic(null);
    setCurrentStep('preview');

    try {
      setLoadingMessage('Selecting background music...');
      const musicTrack = await geminiService.selectMusicTrack(theme, musicSuggestion);
      setSelectedMusic(musicTrack);

      const CONCURRENCY_LIMIT = 5;

      setLoadingMessage(`Generating ${script.length} visuals... (0/${script.length})`);
      const visualTasks = script.map((segment, index) => {
        if (index === 0 && initialImageAsset) {
          return () => Promise.resolve(initialImageAsset);
        }
        return () => geminiService.generateVisual(segment.visuals.trim());
      });
      const visualUrls = await processInBatches(visualTasks, CONCURRENCY_LIMIT, (completed, total) => {
        setLoadingMessage(`Generating ${total} visuals... (${completed}/${total})`);
      });

      if (initialImageAsset) setInitialImageAsset(null); // Consume the image

      setLoadingMessage(`Synthesizing ${script.length} voiceovers... (0/${script.length})`);
      const voiceoverTasks = script.map(segment => () => geminiService.generateVoiceover(segment.narration, segment.voice || 'Puck'));
      const voiceoverB64s = await processInBatches(voiceoverTasks, CONCURRENCY_LIMIT, (completed, total) => {
        setLoadingMessage(`Synthesizing ${total} voiceovers... (${completed}/${total})`);
      });
      
      setLoadingMessage('Decoding audio...');
      const decodedVoiceoverPromises = voiceoverB64s.map(audioB64 => {
          const decodedAudio = decode(audioB64);
          return decodeAudioData(decodedAudio, audioContext, 24000, 1);
      });
      const audioBuffers = await Promise.all(decodedVoiceoverPromises);

      const newMediaAssets = script.map((segment, index) => ({
          segmentId: segment.id,
          type: 'image' as const,
          url: visualUrls[index],
          description: segment.visuals.trim(),
      }));
      
      const newVoiceovers = new Map<string, AudioBuffer>();
      script.forEach((segment, index) => {
          newVoiceovers.set(segment.id, audioBuffers[index]);
      });
      
      setMediaAssets(newMediaAssets);
      setVoiceovers(newVoiceovers);
      
    } catch (e) {
      console.error('Preview generation failed:', e);
      setError(`Failed during preview generation. ${e instanceof Error ? e.message : 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  }, [script, audioContext, theme, musicSuggestion, videoConfig, initialImageAsset]);
  
  const handleFinalize = (videoUrl: string, finalScript: ScriptSegment[] | ScriptSegmentV2[]) => {
    setFinalVideoUrl(videoUrl);
    if (generationVersion === 'v1') {
      setFinalScript(finalScript as ScriptSegment[]);
    } else {
      setFinalScriptV2(finalScript as ScriptSegmentV2[]);
    }
    setAppView('download');
  };


  const renderGenerationContent = () => {
    if (isLoading) {
      return <Loader message={loadingMessage} />;
    }

    switch (currentStep) {
      case 'research':
        return researchData && <ResearchDisplay researchData={researchData} onContinue={handleContinueFromResearch} theme={theme} />;
      case 'script':
         // For V2, we skip this view and go to preview
        return script && generationVersion === 'v1' && <ScriptDisplay script={script} onGeneratePreview={handlePreviewGenerationV1} onScriptChange={handleScriptChange} theme={theme} />;
      case 'preview':
        return videoConfig && (
            <VideoPreview 
                script={script}
                scriptV2={scriptV2}
                mediaAssets={mediaAssets} 
                mediaAssetsV2={mediaAssetsV2}
                voiceovers={voiceovers} 
                audioContext={audioContext} 
                onReset={handleReset} 
                theme={theme} 
                config={videoConfig} 
                watermark={watermark} 
                musicSuggestion={musicSuggestion} 
                selectedMusic={selectedMusic} 
                onFinalize={handleFinalize} 
                setScript={setScript}
                setScriptV2={setScriptV2}
                setMediaAssets={setMediaAssets} 
                setVoiceovers={setVoiceovers} 
                setSelectedMusic={setSelectedMusic}
                generationVersion={generationVersion}
            />
        );
      default:
         return <Loader message={loadingMessage} />;
    }
  };
  
  const renderContent = () => {
    switch (appView) {
      case 'prompt':
        return <PromptInput 
            onGenerate={handleGenerateFromPrompt} 
            initialWatermark={watermark} 
            onOpenOverlay={setActiveOverlay}
            version={generationVersion}
            setVersion={setGenerationVersion}
            disabled={appView !== 'prompt'}
          />;
      case 'generating':
        return (
          <div className="w-full">
            <div className="container mx-auto px-4 md:px-8 pt-8">
              {generationVersion === 'v1' && <AppStepper currentStep={currentStep} />}
            </div>
            <div className="mt-8">
              {renderGenerationContent()}
            </div>
          </div>
        );
      case 'download':
        return finalVideoUrl && videoConfig && <DownloadPage videoUrl={finalVideoUrl} script={finalScript} scriptV2={finalScriptV2} config={videoConfig} theme={theme} onReset={handleReset} />;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="py-6 px-4 sm:px-8 fixed top-0 left-0 w-full z-30 bg-black/80 backdrop-blur-sm">
        <div className="container mx-auto flex justify-between items-center">
          <div>
            <ArideoLogo className="h-8 w-auto" />
          </div>
          {appView !== 'prompt' && (
             <button onClick={handleReset} className="text-sm bg-indigo-600 hover:bg-indigo-700 rounded-md px-4 py-2 transition-colors duration-300 shadow-lg hover:shadow-indigo-500/50">
                Start New Project
            </button>
          )}
        </div>
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center justify-center pt-32">
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6 w-full max-w-4xl animate-fade-in" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Close">
                <span className="text-2xl">&times;</span>
            </button>
          </div>
        )}
        
        {activeOverlay && <Overlay activeOverlay={activeOverlay} onClose={() => setActiveOverlay(null)} onGenerate={handleGenerateFromOverlay} watermark={watermark} />}

        {renderContent()}
      </main>
    </div>
  );
}

export default App;
