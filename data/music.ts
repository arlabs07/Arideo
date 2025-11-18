import { MusicTrack } from '../types';

const reliableMusicUrls = [
    "https://archive.org/download/serge-quadrado-road-trip/Serge%20Quadrado%20-%20Road%20Trip.mp3", // upbeat
    "https://archive.org/download/on-the-verge-of-success/On%20The%20Verge%20of%20Success.mp3", // corporate
    "https://archive.org/download/a-small-miracle/A%20Small%20Miracle.mp3", // chill
    "https://archive.org/download/cinematic-ambient-soundtrack/Cinematic%20Ambient%20Soundtrack.mp3", // cinematic
    "https://archive.org/download/underwater-ambience/Underwater%20Ambience.mp3", // ambient
];

export const musicLibrary: MusicTrack[] = [
    { id: '1', title: "Summer Vibes", artist: "Happy Tunes", url: reliableMusicUrls[0], duration: 0, genre: "upbeat", moods: ["Energetic"] },
    { id: '2', title: "Corporate Success", artist: "Business Beat", url: reliableMusicUrls[1], duration: 0, genre: "corporate", moods: ["Professional"] },
    { id: '3', title: "Chill Lofi Study", artist: "Calm Collective", url: reliableMusicUrls[2], duration: 0, genre: "chill", moods: ["Relaxed"] },
    { id: '4', title: "Epic Trailer", artist: "Cinematic Pro", url: reliableMusicUrls[3], duration: 0, genre: "cinematic", moods: ["Dramatic"] },
    { id: '5', title: "Upbeat Pop", artist: "Sunny Studios", url: reliableMusicUrls[0], duration: 0, genre: "upbeat", moods: ["Joyful"] },
    { id: '6', title: "Ambient Space", artist: "Deep Sound", url: reliableMusicUrls[4], duration: 0, genre: "ambient", moods: ["Ethereal"] },
    { id: '7', title: "Motivational Rise", artist: "Inspire Audio", url: reliableMusicUrls[1], duration: 0, genre: "corporate", moods: ["Uplifting"] },
    { id: '8', title: "Lofi Hip Hop", artist: "Beat Makers", url: reliableMusicUrls[2], duration: 0, genre: "chill", moods: ["Smooth"] },
    { id: '9', title: "Action Cinematic", artist: "Epic Sounds", url: reliableMusicUrls[3], duration: 0, genre: "cinematic", moods: ["Intense"] },
    { id: '10', title: "Happy Ukulele", artist: "Cheerful Melody", url: reliableMusicUrls[0], duration: 0, genre: "upbeat", moods: ["Playful"] },
    { id: '11', title: "Deep Meditation", artist: "Zen Masters", url: reliableMusicUrls[4], duration: 0, genre: "ambient", moods: ["Peaceful"] },
    { id: '12', title: "Tech Startup", artist: "Modern Music", url: reliableMusicUrls[1], duration: 0, genre: "corporate", moods: ["Innovative"] },
    { id: '13', title: "Acoustic Chill", artist: "Guitar Vibes", url: reliableMusicUrls[2], duration: 0, genre: "chill", moods: ["Mellow"] },
    { id: '14', title: "Orchestral Epic", artist: "Symphony Studio", url: reliableMusicUrls[3], duration: 0, genre: "cinematic", moods: ["Grand"] },
    { id: '15', title: "Dance Party", artist: "Club Beats", url: reliableMusicUrls[0], duration: 0, genre: "upbeat", moods: ["Energetic"] },
    { id: '16', title: "Nature Sounds", artist: "Ambient Earth", url: reliableMusicUrls[4], duration: 0, genre: "ambient", moods: ["Serene"] },
    { id: '17', title: "Business Presentation", artist: "Corporate Audio", url: reliableMusicUrls[1], duration: 0, genre: "corporate", moods: ["Confident"] },
    { id: '18', title: "Coffee Shop Jazz", artist: "Smooth Jazz", url: reliableMusicUrls[2], duration: 0, genre: "chill", moods: ["Cozy"] },
    { id: '19', title: "Hero's Journey", artist: "Adventure Music", url: reliableMusicUrls[3], duration: 0, genre: "cinematic", moods: ["Heroic"] },
    { id: '20', title: "Funky Groove", artist: "Retro Beats", url: reliableMusicUrls[0], duration: 0, genre: "upbeat", moods: ["Funky"] }
];
