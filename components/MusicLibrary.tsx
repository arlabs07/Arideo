import React, { useState, useEffect, useRef, useMemo } from 'react';
import { musicLibrary } from '../data/music';
import { MusicTrack } from '../types';

interface MusicLibraryProps {
    onSelectTrack: (track: MusicTrack) => void;
    onClose: () => void;
    currentTrackId?: string | null;
}

const filters = [
    { id: 'all', name: 'All', icon: 'public' },
    { id: 'upbeat', name: 'Upbeat', icon: 'local_fire_department' },
    { id: 'chill', name: 'Chill', icon: 'filter_drama' },
    { id: 'cinematic', name: 'Epic', icon: 'theaters' },
    { id: 'corporate', name: 'Corporate', icon: 'business_center' },
    { id: 'ambient', name: 'Ambient', icon: 'spa' },
];

const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const MusicLibrary: React.FC<MusicLibraryProps> = ({ onSelectTrack, onClose, currentTrackId }) => {
    const [activeFilter, setActiveFilter] = useState('all');
    const [trackDurations, setTrackDurations] = useState<Record<string, number>>({});
    
    // Player state
    const [currentTrack, setCurrentTrack] = useState<MusicTrack | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(0.7);

    const audioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        // Preload durations
        musicLibrary.forEach(track => {
            const tempAudio = new Audio(track.url);
            tempAudio.addEventListener('loadedmetadata', () => {
                setTrackDurations(prev => ({ ...prev, [track.id]: tempAudio.duration }));
            });
        });
        
        // Setup audio element
        audioRef.current = new Audio();
        audioRef.current.volume = volume;

        const audio = audioRef.current;

        const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
        const handleLoadedMetadata = () => setDuration(audio.duration);
        const handleEnded = () => {
            setIsPlaying(false);
            // Optional: play next song in list
        };
        
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('ended', handleEnded);

        return () => {
            audio.pause();
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('ended', handleEnded);
        };
    }, []);

    const filteredTracks = useMemo(() => {
        if (activeFilter === 'all') return musicLibrary;
        return musicLibrary.filter(t => t.genre === activeFilter);
    }, [activeFilter]);

    const playTrack = (track: MusicTrack) => {
        if (!audioRef.current) return;
        if (currentTrack?.id === track.id) {
            if (isPlaying) {
                audioRef.current.pause();
                setIsPlaying(false);
            } else {
                audioRef.current.play();
                setIsPlaying(true);
            }
        } else {
            setCurrentTrack(track);
            audioRef.current.src = track.url;
            audioRef.current.play();
            setIsPlaying(true);
        }
    };
    
    const togglePlayPause = () => {
        if (!audioRef.current || !currentTrack) return;
        if (isPlaying) {
            audioRef.current.pause();
            setIsPlaying(false);
        } else {
            audioRef.current.play();
            setIsPlaying(true);
        }
    };
    
    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseFloat(e.target.value);
        setVolume(newVolume);
        if (audioRef.current) {
            audioRef.current.volume = newVolume;
        }
    };
    
    const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!audioRef.current || !currentTrack) return;
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        audioRef.current.currentTime = percentage * duration;
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-gray-900/80 border border-gray-700 w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden animate-fade-in-up" 
                onClick={e => e.stopPropagation()}
            >
                <header className="p-6 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                        <span className="material-symbols-outlined text-purple-400">album</span>
                        Music Library
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-700 transition-colors">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </header>

                <div className="p-4 border-b border-gray-700 flex-shrink-0">
                    <div className="flex flex-wrap gap-2 justify-center">
                        {filters.map(filter => (
                            <button 
                                key={filter.id}
                                onClick={() => setActiveFilter(filter.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${activeFilter === filter.id ? 'bg-purple-600 text-white shadow-lg' : 'bg-gray-800/50 hover:bg-gray-700'}`}
                            >
                                <span className="material-symbols-outlined text-base">{filter.icon}</span>
                                <span className="hidden sm:inline">{filter.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-grow flex flex-col md:flex-row gap-8 p-6 overflow-hidden">
                    <div className="md:w-2/3 h-full overflow-y-auto pr-2 space-y-3">
                        {filteredTracks.map(track => (
                            <div 
                                key={track.id} 
                                className={`rounded-xl p-4 flex items-center justify-between transition-all duration-300 border-l-4 ${currentTrack?.id === track.id ? 'bg-purple-600/20 border-purple-500' : 'bg-gray-800/30 border-transparent hover:border-purple-500/50 hover:bg-purple-600/10'}`}
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <button onClick={() => playTrack(track)} className="w-12 h-12 bg-purple-600/50 rounded-lg flex items-center justify-center flex-shrink-0 text-purple-200 hover:bg-purple-600/80 transition-colors">
                                        <span className="material-symbols-outlined text-3xl">{isPlaying && currentTrack?.id === track.id ? 'pause' : 'play_arrow'}</span>
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-semibold truncate">{track.title}</h4>
                                        <p className="text-sm text-gray-400">{track.artist} &bull; {track.moods[0]}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 ml-4">
                                    <span className="text-sm text-gray-400 font-mono hidden sm:block">{formatTime(trackDurations[track.id] || 0)}</span>
                                    <button 
                                        onClick={() => onSelectTrack(track)} 
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${currentTrackId === track.id ? 'bg-green-600 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                                    >
                                        {currentTrackId === track.id ? 'Selected' : 'Select'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="md:w-1/3 bg-gray-800/50 rounded-2xl p-6 flex flex-col justify-center sticky top-0">
                       {currentTrack ? (
                           <>
                            <div className="text-center mb-6">
                                <div className="w-32 h-32 bg-purple-600 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg">
                                    <span className="material-symbols-outlined text-6xl text-white/80">music_note</span>
                                </div>
                                <h4 className="font-bold text-xl mb-1">{currentTrack.title}</h4>
                                <p className="text-gray-400 mb-2">{currentTrack.artist}</p>
                                <span className="inline-block px-3 py-1 bg-purple-600/30 text-purple-300 rounded-full text-sm">{currentTrack.moods[0]}</span>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <button onClick={togglePlayPause} className="w-14 h-14 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center transition-all transform hover:scale-110 flex-shrink-0">
                                        <span className="material-symbols-outlined text-4xl">{isPlaying ? 'pause' : 'play_arrow'}</span>
                                    </button>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>{formatTime(currentTime)}</span>
                                            <span>{formatTime(duration)}</span>
                                        </div>
                                        <div onClick={handleProgressSeek} className="bg-gray-700 h-2 rounded-full overflow-hidden cursor-pointer group">
                                            <div className="bg-purple-500 h-full group-hover:bg-purple-400" style={{ width: `${(currentTime / duration) * 100 || 0}%` }}></div>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-purple-400">volume_up</span>
                                    <input 
                                        type="range" 
                                        min="0" max="1" step="0.01" 
                                        value={volume}
                                        onChange={handleVolumeChange}
                                        className="flex-1 h-2 bg-gray-700 rounded-full appearance-none cursor-pointer" 
                                        style={{ accentColor: '#9333ea' }}
                                    />
                                </div>
                                <div className={`waveform h-10 flex items-center justify-center gap-1 ${isPlaying ? '' : 'opacity-0'}`}>
                                    {Array(9).fill(0).map((_, i) => <span key={i} style={{ height: `${[20, 40, 60, 80, 100, 80, 60, 40, 20][i]}%` }}></span>)}
                                </div>
                            </div>
                           </>
                       ) : (
                           <div className="text-center py-8 text-gray-500">
                                <span className="material-symbols-outlined text-6xl mb-3 opacity-30">queue_music</span>
                                <p>Select a track to preview</p>
                            </div>
                       )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MusicLibrary;
