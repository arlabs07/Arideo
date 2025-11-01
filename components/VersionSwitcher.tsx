import React, { useState, useRef, useEffect } from 'react';
import { CheckIcon } from './icons/CheckIcon';
import { MagicIcon } from './icons/MagicIcon';
import { WorkflowIcon } from './icons/WorkflowIcon';

interface VersionSwitcherProps {
  version: 'v1' | 'v2';
  setVersion: (version: 'v1' | 'v2') => void;
  disabled?: boolean;
}

const versions = {
  v1: {
    name: 'V1',
    title: 'V1',
    description: 'Standard image-based generation.',
    icon: MagicIcon,
  },
  v2: {
    name: 'V2',
    title: 'V2',
    description: 'Dynamic canvas with animated motion graphics.',
    icon: WorkflowIcon,
  },
};

const VersionSwitcher: React.FC<VersionSwitcherProps> = ({ version, setVersion, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selectedVersion = versions[version];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (v: 'v1' | 'v2') => {
    setVersion(v);
    setIsOpen(false);
  };

  return (
    <div className="relative w-64" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`w-full flex items-center justify-between text-left p-3 bg-[#1A1A1A] border border-gray-700 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'}`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <selectedVersion.icon className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-white">{selectedVersion.name}</span>
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-[#1F1F1F] border border-gray-700 rounded-lg shadow-lg" role="listbox">
          {Object.entries(versions).map(([key, value]) => (
            <button
              key={key}
              type="button"
              onClick={() => handleSelect(key as 'v1' | 'v2')}
              className="w-full text-left p-3 hover:bg-indigo-600/30 transition-colors flex items-center justify-between first:rounded-t-lg last:rounded-b-lg"
              role="option"
              aria-selected={version === key}
            >
              <div className="flex items-center gap-3">
                <value.icon className={`w-5 h-5 ${version === key ? 'text-indigo-400' : 'text-gray-500'}`} />
                <div>
                  <span className="font-semibold text-white">{value.title}</span>
                  <span className="text-xs text-gray-400 block">{value.description}</span>
                </div>
              </div>
              {version === key && <CheckIcon className="w-5 h-5 text-green-400" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VersionSwitcher;
