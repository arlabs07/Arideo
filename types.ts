
export interface ScriptSegment {
  id: string;
  timestamp: string;
  visuals: string;
  narration: string;
  transition: string;
  voice?: string;
}

export interface ElementAnimation {
  type: 'fade-in' | 'slide-in-left' | 'slide-in-right' | 'slide-in-top' | 'slide-in-bottom' | 'zoom-in' | 'zoom-out' | 'scale-up' | 'rotate-in';
  start: number;
  duration: number;
  exit?: {
    type: 'fade-out' | 'slide-out-left' | 'slide-out-right' | 'slide-out-top' | 'slide-out-bottom' | 'zoom-out';
    start: number;
    duration: number;
  };
}

export interface SceneElement {
  id: string;
  type: 'image' | 'text';
  prompt?: string;
  text?: string;
  style: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    textAlign?: 'left' | 'center' | 'right';
    verticalAlign?: 'top' | 'middle' | 'bottom';
    fontWeight?: string;
  };
  layout: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  animation: ElementAnimation;
}

export interface ScriptSegmentV2 {
  id: string;
  narration: string;
  elements: SceneElement[];
  voice?: string;
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
  subtitles?: boolean;
  voiceStyle?: 'concise' | 'standard' | 'longer voice over';
  voicePreference?: string;
  stylePreference?: string;
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