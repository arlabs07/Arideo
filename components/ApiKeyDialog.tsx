import React from 'react';

interface ApiKeyDialogProps {
  onSelectKey: () => void;
  onCancel: () => void;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({ onSelectKey, onCancel }) => {
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#101010] rounded-2xl w-full max-w-md shadow-2xl shadow-indigo-900/20 border border-gray-800 flex flex-col animate-fade-in-up p-8 text-center">
        <h3 className="text-2xl font-bold mb-4">API Key Required</h3>
        <p className="text-gray-400 mb-6">
          The advanced V2 video generation uses the Veo model, which requires you to select a project with an enabled API key.
        </p>
        <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline text-sm mb-6">
          Learn more about billing
        </a>
        <div className="flex justify-center gap-4">
          <button onClick={onCancel} className="text-gray-400 hover:text-white transition-colors px-6 py-2 rounded-lg bg-gray-700 hover:bg-gray-600">
            Cancel
          </button>
          <button onClick={onSelectKey} className="bg-blue-600 text-white font-semibold rounded-lg px-8 py-2 hover:bg-blue-700 transition-all transform hover:scale-105">
            Select API Key
          </button>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyDialog;