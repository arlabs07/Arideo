import React, { useState, useRef, useEffect } from 'react';

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
    icon: 'auto_awesome',
  },
  v2: {
    name: 'V2',
    title: 'V2',
    description: 'Dynamic canvas with animated motion graphics.',
    icon: 'account_tree',
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
          <span className="material-symbols-outlined text-indigo-400">{selectedVersion.icon}</span>
          <span className="font-semibold text-white">{selectedVersion.name}</span>
        </div>
        <span className={`material-symbols-outlined text-gray-400 transition-transform duration-200 ${isOpen ? 'transform rotate-180' : ''}`}>
            arrow_drop_down
        </span>
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
                <span className={`material-symbols-outlined ${version === key ? 'text-indigo-400' : 'text-gray-500'}`}>{value.icon}</span>
                <div>
                  <span className="font-semibold text-white">{value.title}</span>
                  <span className="text-xs text-gray-400 block">{value.description}</span>
                </div>
              </div>
              {version === key && <span className="material-symbols-outlined text-green-400">check</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default VersionSwitcher;