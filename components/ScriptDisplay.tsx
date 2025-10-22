import React from 'react';
import { ScriptSegment } from '../types';

interface ScriptDisplayProps {
  script: ScriptSegment[];
  onGeneratePreview: () => void;
  onScriptChange: (index: number, field: 'narration' | 'visuals', value: string) => void;
  theme: string;
}

const AutoGrowTextarea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => {
    const ref = React.useRef<HTMLTextAreaElement>(null);

    React.useLayoutEffect(() => {
        const el = ref.current;
        if (el) {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        }
    }, [props.value]);

    return <textarea ref={ref} {...props} />;
};


const ScriptDisplay: React.FC<ScriptDisplayProps> = ({ script, onGeneratePreview, onScriptChange, theme }) => {
  return (
    <div className="w-full max-w-4xl animate-fade-in-up">
       <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mt-1">Video Script for: "{theme}"</h2>
            <p className="text-gray-400 mt-2">Review and edit the generated script below. When you're ready, proceed to the next step.</p>
        </div>
      <div className="space-y-6 max-h-[60vh] overflow-y-auto p-2">
        {script.map((segment, index) => (
          <div key={segment.id} className="p-4 rounded-lg transform transition-transform hover:bg-gray-800/30 border-b-2 border-gray-800">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-indigo-400">Scene {index + 1}</h3>
              <span className="text-sm font-mono bg-gray-900 px-2 py-1 rounded-md">{segment.timestamp}</span>
            </div>
            
            <div className="space-y-3">
                <div>
                    <label className="text-gray-100 font-semibold text-sm mb-1 block">Visuals:</label>
                    <AutoGrowTextarea
                        value={segment.visuals}
                        onChange={(e) => onScriptChange(index, 'visuals', e.target.value)}
                        className="w-full bg-transparent p-2 rounded-md transition-colors focus:bg-gray-900/50 focus:border-indigo-600 focus:outline-none ring-1 ring-transparent focus:ring-indigo-500 resize-none text-gray-300"
                        rows={2}
                    />
                </div>
                 <div>
                    <label className="text-gray-100 font-semibold text-sm mb-1 block">Narration:</label>
                    <AutoGrowTextarea
                        value={segment.narration}
                        onChange={(e) => onScriptChange(index, 'narration', e.target.value)}
                         className="w-full bg-transparent p-2 rounded-md transition-colors focus:bg-gray-900/50 focus:border-indigo-600 focus:outline-none ring-1 ring-transparent focus:ring-indigo-500 resize-none text-gray-300"
                        rows={1}
                    />
                </div>
            </div>

             {segment.transition && (
                <p className="text-sm text-purple-400 mt-4 italic text-right">→ Transition: {segment.transition}</p>
             )}
          </div>
        ))}
      </div>
      <div className="mt-8 text-center">
        <button
          onClick={onGeneratePreview}
          className="bg-purple-600 text-white font-semibold rounded-lg px-8 py-4 text-lg hover:bg-purple-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-purple-500/50"
        >
          Generate Video Preview
        </button>
      </div>
    </div>
  );
};

export default ScriptDisplay;
