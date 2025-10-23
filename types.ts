
export interface ScriptSegment {
  id: string;
  timestamp: string;
  visuals: string;
  narration: string;
  transition: string;
}

export interface MediaAsset {
  segmentId: string;
  type: 'image';
  url: string;
  description: string;
}

export type AspectRatio = '16:9' | '9:16' | '1:1' | '2.35:1';

export interface VideoConfig {
  aspectRatio: AspectRatio;
  duration: number; // in seconds
}

export interface MusicSuggestion {
  mood: string;
  genre: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  url:string;
  genre: string;
  moods: string[];
  duration: number; // in seconds
}

export interface VideoMetadata {
  title: string;
  description: string;
  chapters: {
    timestamp: string;
    title: string;
  }[];
  tags: string[];
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
}

export interface ToolCall {
    name: string;
    args: any;
}
