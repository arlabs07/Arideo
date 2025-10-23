import React, { useState, useCallback, useMemo } from 'react';
import { ScriptSegment, MediaAsset, VideoConfig, MusicSuggestion, MusicTrack, VideoMetadata } from './types';
import * as geminiService from './services/geminiService';
import { decodeAudioData, decode } from './utils/audioUtils';
import PromptInput from './components/PromptInput';
import Overlay from './components/Overlay';
import ScriptDisplay from './components/ScriptDisplay';
import VideoPreview from './components/VideoPreview';
import Loader from './components/Loader';
import ResearchDisplay from './components/ResearchDisplay';
import { CheckIcon } from './components/icons/CheckIcon';
import { ArideoLogo } from './ArideoLogo';
import DownloadPage from './components/DownloadPage';

type AppView = 'prompt' | 'generating' | 'download';
type AppStep = 'theme' | 'research' | 'script' | 'preview';

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
                                    {isCompleted ? <CheckIcon className="w-6 h-6 text-white"/> : <span className={`font-bold text-lg ${isActive ? 'text-indigo-400' : 'text-gray-500'}`}>{index + 1}</span>}
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
  const [musicSuggestion, setMusicSuggestion] = useState<MusicSuggestion | null>(null);
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[] | null>(null);
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

  const audioContext = useMemo(() => new (window.AudioContext || (window as any).webkitAudioContext)(), []);

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
        handleReset(); // Go back to prompt on failure
    } finally {
        setIsLoading(false);
    }
  }, []);

  const handleGenerateFromPrompt = async (prompt: string, newWatermark: string | null, userImage: string | null) => {
    setWatermark(newWatermark);
    setInitialImageAsset(userImage);
    setIsLoading(true);
    setError(null);
    setLoadingMessage("Understanding your video idea...");
    setAppView('generating');
    setCurrentStep('theme');
    
    try {
      const { theme: parsedTheme, ...parsedConfig } = await geminiService.parsePromptForConfig(prompt);
      await handleResearch(parsedTheme, parsedConfig);
    } catch (e) {
        console.error('Prompt parsing or research failed:', e);
        setError(e instanceof Error ? e.message : 'Could not understand your prompt. Please be more specific.');
        setAppView('prompt');
        setIsLoading(false);
    }
  };
  
  const handleGenerateFromOverlay = (prompt: string, newWatermark: string | null) => {
    setActiveOverlay(null);
    handleGenerateFromPrompt(prompt, newWatermark, null);
  };


  const handleScriptGeneration = useCallback(async () => {
    if (!theme || !videoConfig || !researchData) return;

    setIsLoading(true);
    setLoadingMessage('Generating professional script from research...');
    setError(null);
    setScript(null);
    setMusicSuggestion(null);
    setCurrentStep('script');

    try {
      const generatedScript = await geminiService.generateScript(theme, videoConfig.duration, researchData.summary);
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

  const handleScriptChange = useCallback((index: number, field: 'narration' | 'visuals', value: string) => {
    setScript(prevScript => {
      if (!prevScript) return null;
      const newScript = [...prevScript];
      newScript[index] = { ...newScript[index], [field]: value };
      return newScript;
    });
  }, []);

  const handlePreviewGeneration = useCallback(async () => {
    if (!script || !theme || !musicSuggestion || !videoConfig) return;

    setIsLoading(true);
    setLoadingMessage('Preparing video generation...');
    setError(null);
    setMediaAssets(null);
    setVoiceovers(new Map());
    setSelectedMusic(null);
    setCurrentStep('preview');

    try {
      const voiceName = 'Puck'; // Default voice
      
      setLoadingMessage('Selecting background music...');
      const musicTrack = await geminiService.selectMusicTrack(theme, musicSuggestion);
      setSelectedMusic(musicTrack);

      const newMediaAssets: MediaAsset[] = [];
      const newVoiceovers = new Map<string, AudioBuffer>();

      for (const [index, segment] of script.entries()) {
          const sceneNum = index + 1;
          const totalScenes = script.length;
          const visualPrompt = segment.visuals.trim();
          
          setLoadingMessage(`[${sceneNum}/${totalScenes}] Generating visual...`);
          
          let mediaUrl: string;
          if (index === 0 && initialImageAsset) {
              mediaUrl = initialImageAsset;
              setInitialImageAsset(null); // Consume the image
          } else {
              mediaUrl = await geminiService.generateVisual(visualPrompt);
          }
          
          setLoadingMessage(`[${sceneNum}/${totalScenes}] Synthesizing voice...`);
          const audioB64 = await geminiService.generateVoiceover(segment.narration, voiceName);
          const decodedAudio = decode(audioB64);
          const audioBuffer = await decodeAudioData(decodedAudio, audioContext, 24000, 1);

          newMediaAssets.push({ segmentId: segment.id, type: 'image', url: mediaUrl, description: visualPrompt });
          newVoiceovers.set(segment.id, audioBuffer);
      }
      
      setMediaAssets(newMediaAssets);
      setVoiceovers(newVoiceovers);
      
    } catch (e) {
      console.error('Preview generation failed:', e);
      setError(`Failed during preview generation. ${e instanceof Error ? e.message : 'Please try again.'}`);
    } finally {
      setIsLoading(false);
    }
  }, [script, audioContext, theme, musicSuggestion, videoConfig, initialImageAsset]);
  
  const handleFinalize = (videoUrl: string, finalScript: ScriptSegment[]) => {
    setFinalVideoUrl(videoUrl);
    setFinalScript(finalScript);
    setAppView('download');
  };

  const handleReset = () => {
    setTheme('');
    setVideoConfig(null);
    setResearchData(null);
    setScript(null);
    setMusicSuggestion(null);
    setSelectedMusic(null);
    setMediaAssets(null);
    setVoiceovers(new Map());
    setFinalVideoUrl(null);
    setFinalScript(null);
    setCurrentStep('theme');
    setError(null);
    setIsLoading(false);
    setWatermark(null);
    setInitialImageAsset(null);
    setAppView('prompt');
  };

  const renderGenerationContent = () => {
    if (isLoading) {
      return <Loader message={loadingMessage} />;
    }

    switch (currentStep) {
      case 'research':
        return researchData && <ResearchDisplay researchData={researchData} onContinue={handleScriptGeneration} theme={theme} />;
      case 'script':
        return script && <ScriptDisplay script={script} onGeneratePreview={handlePreviewGeneration} onScriptChange={handleScriptChange} theme={theme} />;
      case 'preview':
        return script && mediaAssets && videoConfig && <VideoPreview script={script} mediaAssets={mediaAssets} voiceovers={voiceovers} audioContext={audioContext} onReset={handleReset} theme={theme} config={videoConfig} watermark={watermark} musicSuggestion={musicSuggestion} selectedMusic={selectedMusic} onFinalize={handleFinalize} setScript={setScript} setMediaAssets={setMediaAssets} setVoiceovers={setVoiceovers} setSelectedMusic={setSelectedMusic} />;
      default:
         return <Loader message={loadingMessage} />;
    }
  };
  
  const renderContent = () => {
    switch (appView) {
      case 'prompt':
        return <PromptInput onGenerate={handleGenerateFromPrompt} initialWatermark={watermark} onOpenOverlay={setActiveOverlay} />;
      case 'generating':
        return (
          <div className="w-full">
            <div className="container mx-auto px-4 md:px-8 pt-8">
              <AppStepper currentStep={currentStep} />
            </div>
            <div className="mt-8">
              {renderGenerationContent()}
            </div>
          </div>
        );
      case 'download':
        return finalVideoUrl && finalScript && videoConfig && <DownloadPage videoUrl={finalVideoUrl} script={finalScript} config={videoConfig} theme={theme} onReset={handleReset} />;
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <header className="py-6 px-4 sm:px-8 fixed top-0 left-0 w-full z-30 bg-black">
        <div className="container mx-auto flex justify-between items-center">
          <ArideoLogo className="h-8 w-auto" />
          {appView !== 'prompt' && (
             <button onClick={handleReset} className="text-sm bg-indigo-600 hover:bg-indigo-700 rounded-md px-4 py-2 transition-colors duration-300 shadow-lg hover:shadow-indigo-500/50">
                Start New Project
            </button>
          )}
        </div>
      </header>
      
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col items-center justify-center pt-28">
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
