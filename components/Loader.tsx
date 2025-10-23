import React, { useMemo } from 'react';

interface LoaderProps {
  message: string;
}

const steps = [
  'research', 'script', 'tone', 'music', 'visual', 'voice', 'synthesizing', 'video'
];

const getStepFromMessage = (message: string): number => {
    const msg = message.toLowerCase();
    if (msg.includes('research')) return 1;
    if (msg.includes('script')) return 2;
    if (msg.includes('tone') || msg.includes('analyzing')) return 3;
    if (msg.includes('music')) return 4;
    if (msg.includes('visual')) return 5;
    if (msg.includes('voice') || msg.includes('synthesizing')) return 6;
    if (msg.includes('video')) return 7;
    return 0;
};

const Loader: React.FC<LoaderProps> = ({ message }) => {
    const currentStepIndex = useMemo(() => getStepFromMessage(message), [message]);

    const generationSteps = [
        "Conducting research",
        "Writing script",
        "Analyzing tone",
        "Selecting music",
        "Generating visuals",
        "Synthesizing voiceovers",
        "Assembling preview"
    ];

    return (
        <div className="flex flex-col items-center justify-center text-center p-8 w-full animate-fade-in-up relative overflow-hidden rounded-lg">
            <div className="absolute inset-0 bg-gradient-to-tr from-gray-900 via-indigo-900/40 to-black animate-[spin_20s_linear_infinite]" style={{ animationDirection: 'reverse' }}></div>
            <div className="relative z-10">
                <div className="w-24 h-24 relative mb-6 mx-auto">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
                    <div className="absolute inset-2 rounded-full border-4 border-indigo-500/30 animate-[spin_2s_linear_infinite]"></div>
                    <div className="absolute inset-4 rounded-full border-4 border-indigo-500/40 animate-[spin_3s_linear_infinite]" style={{ animationDirection: 'reverse' }}></div>
                    <div className="w-full h-full flex items-center justify-center">
                        <svg className="h-10 w-10 text-indigo-400 animate-pulse" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.898 20.502L16.5 21.75l-.398-1.248a3.375 3.375 0 00-2.455-2.456L12.75 18l1.248-.398a3.375 3.375 0 002.455-2.456L16.5 14.25l.398 1.248a3.375 3.375 0 002.456 2.456l1.248.398-1.248.398a3.375 3.375 0 00-2.456 2.456z"/>
                        </svg>
                    </div>
                </div>

                <h2 className="text-2xl font-semibold text-white mb-2">{message}</h2>
                <p className="text-gray-400">Arideo is crafting your masterpiece, please wait...</p>

                <div className="mt-8 w-full max-w-md">
                    <div className="space-y-2">
                        {generationSteps.map((step, index) => {
                            const isCompleted = currentStepIndex > index + 1;
                            const isActive = currentStepIndex === index + 1;
                            return (
                                <div key={step} className={`flex items-center gap-3 transition-all duration-300 ${isActive ? 'text-white' : isCompleted ? 'text-green-400' : 'text-gray-500'}`}>
                                    <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0">
                                        {isCompleted ? '✓' : isActive ? '→' : '•'}
                                    </div>
                                    <span className={`text-sm ${isActive && 'font-semibold'}`}>{step}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Loader;
