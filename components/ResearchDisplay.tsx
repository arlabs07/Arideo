import React from 'react';
import { LinkIcon } from './icons/LinkIcon';

interface ResearchDisplayProps {
  researchData: {
    summary: string;
    sources: { uri: string; title: string; }[];
  };
  onContinue: () => void;
  theme: string;
}

const ResearchDisplay: React.FC<ResearchDisplayProps> = ({ researchData, onContinue, theme }) => {
  return (
    <div className="w-full max-w-4xl animate-fade-in">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mt-1">Research for: "{theme}"</h2>
        <p className="text-gray-400 mt-2">Here's a summary of information found on the web. Review and proceed to script generation.</p>
      </div>
      
      <div className="space-y-8">
        <div>
          <h3 className="text-xl font-semibold mb-3 text-white">AI-Generated Summary</h3>
          <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">{researchData.summary}</p>
        </div>

        {researchData.sources.length > 0 && (
          <div>
            <hr className="border-gray-800 my-8" />
            <h3 className="text-xl font-semibold mb-4 text-white">Sources</h3>
            <ul className="space-y-3 max-h-48 overflow-y-auto pr-2">
              {researchData.sources.map((source, index) => (
                <li key={index} className="flex items-start gap-3">
                  <LinkIcon className="w-5 h-5 text-indigo-400 mt-1 flex-shrink-0" />
                  <a href={source.uri} target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:text-indigo-300 hover:underline transition-colors text-sm break-all">
                    {source.title || source.uri}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>


      <div className="mt-12 text-center">
        <button
          onClick={onContinue}
          className="bg-indigo-600 text-white font-semibold rounded-lg px-8 py-4 text-lg hover:bg-indigo-700 transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-indigo-500/50"
        >
          Generate Script
        </button>
      </div>
    </div>
  );
};

export default ResearchDisplay;
