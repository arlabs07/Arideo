import { GoogleGenAI, Type, Modality } from "@google/genai";
import { ScriptSegment, MusicSuggestion, MusicTrack, VideoMetadata, VideoConfig } from '../types';

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const musicLibrary: MusicTrack[] = [
    { id: 'inspiring-cinematic-lexin', title: 'Inspiring Cinematic Ambient', artist: 'Lexin Music', url: 'https://cdn.pixabay.com/download/audio/2022/08/04/audio_29b28a8692.mp3', genre: 'Cinematic', moods: ['inspiring', 'hopeful', 'ambient', 'calm', 'motivational'], duration: 137 },
    { id: 'upbeat-corporate-usfx', title: 'Upbeat Corporate', artist: 'Universal Sound FX', url: 'https://cdn.pixabay.com/download/audio/2023/07/14/audio_651a374946.mp3', genre: 'Corporate', moods: ['upbeat', 'motivational', 'energetic', 'positive', 'happy'], duration: 122 },
    { id: 'dramatic-epic-zakhar', title: 'The Epic', artist: 'Zakhar Valaha', url: 'https://cdn.pixabay.com/download/audio/2023/02/16/audio_191983419b.mp3', genre: 'Orchestral', moods: ['dramatic', 'epic', 'action', 'intense', 'trailer'], duration: 132 },
    { id: 'lofi-chill-bodleasons', title: 'Lofi Chill', artist: 'BoDleasons', url: 'https://cdn.pixabay.com/download/audio/2022/05/23/audio_b723ace3d9.mp3', genre: 'Lo-fi', moods: ['chill', 'relaxed', 'calm', 'studying', 'background'], duration: 120 },
    { id: 'ambient-documentary-audiovip', title: 'Ambient Documentary', artist: 'Audio-VIP', url: 'https://cdn.pixabay.com/download/audio/2022/08/02/audio_7313a04297.mp3', genre: 'Ambient', moods: ['thoughtful', 'documentary', 'serious', 'calm', 'introspective'], duration: 178 },
    { id: 'energetic-rock-lite', title: 'Powerful Rock', artist: 'Lite-Saturation', url: 'https://cdn.pixabay.com/download/audio/2021/08/11/audio_42c525f05b.mp3', genre: 'Rock', moods: ['energetic', 'powerful', 'driving', 'action', 'upbeat'], duration: 136 },
];

const scriptSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        timestamp: { type: Type.STRING, description: 'Timestamp for the segment, e.g., "00:00 - 00:05".' },
        visuals: { type: Type.STRING, description: 'Detailed description of the visuals (suggesting images, GIFs, or short video clips).' },
        narration: { type: Type.STRING, description: 'The narration/voiceover text for this segment. Must be a single, concise line.' },
        transition: { type: Type.STRING, description: 'The transition to the next scene, e.g., "Cut to", "Fade out", "Wipe left".' }
      },
      required: ['timestamp', 'visuals', 'narration', 'transition'],
    }
};

const musicSuggestionSchema = {
    type: Type.OBJECT,
    properties: {
      mood: { type: Type.STRING, description: 'The overall mood of the music, e.g., "inspirational", "dramatic", "upbeat".' },
      genre: { type: Type.STRING, description: 'The genre of the music, e.g., "cinematic orchestral", "lo-fi beats", "ambient electronic".' }
    },
    required: ['mood', 'genre']
};

const musicSelectionSchema = {
    type: Type.OBJECT,
    properties: {
        trackId: { type: Type.STRING, description: 'The ID of the most suitable track from the provided list.' },
        reasoning: { type: Type.STRING, description: 'A brief explanation for why this track was chosen.' }
    },
    required: ['trackId', 'reasoning']
};

const videoMetadataSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING, description: 'A catchy, SEO-friendly title for the video.' },
        description: { type: Type.STRING, description: 'A detailed, engaging YouTube-style description for the video, including a brief summary. Use line breaks (\\n) for readability.' },
        chapters: {
            type: Type.ARRAY,
            description: 'A list of timestamped chapters for the video.',
            items: {
                type: Type.OBJECT,
                properties: {
                    timestamp: { type: Type.STRING, description: 'The start time of the chapter, e.g., "00:00".' },
                    title: { type: Type.STRING, description: 'A short, descriptive title for the chapter.' }
                },
                required: ['timestamp', 'title']
            }
        },
        tags: {
            type: Type.ARRAY,
            description: 'A list of 5-10 relevant keywords or tags for discoverability.',
            items: { type: Type.STRING }
        }
    },
    required: ['title', 'description', 'chapters', 'tags']
};

export interface ResearchResult {
    summary: string;
    sources: { uri: string; title: string; }[];
}

export async function parsePromptForConfig(prompt: string): Promise<VideoConfig & { theme: string }> {
    const configSchema = {
        type: Type.OBJECT,
        properties: {
            theme: { type: Type.STRING, description: 'The main topic or subject of the video. This should be a concise summary of the user\'s request.' },
            duration: { type: Type.NUMBER, description: 'The target duration of the video in seconds. Default to 30 if not specified.' },
            aspectRatio: { 
                type: Type.STRING, 
                description: 'The aspect ratio of the video. Common values are "16:9" (for YouTube/widescreen), "9:16" (for TikTok/Shorts), "1:1" (for Instagram). Default to "16:9" if not specified.',
                enum: ['16:9', '9:16', '1:1', '2.35:1']
            }
        },
        required: ['theme', 'duration', 'aspectRatio']
    };

    const generationPrompt = `Analyze the following user request for a video. Extract the core theme, desired duration in seconds, and aspect ratio.
    - If the user mentions platforms like "short video", "tiktok", "reels", "shorts" or "vertical", assume a 9:16 aspect ratio.
    - If the user mentions "youtube video", "widescreen", "cinematic", assume a 16:9 aspect ratio.
    - If the user mentions "instagram post" or "square", assume a 1:1 aspect ratio.
    - If duration is mentioned in minutes, convert it to seconds (e.g., "1 minute" is 60).
    - If no duration is specified, default to 30 seconds.
    - If no aspect ratio is specified, default to 16:9.
    - The theme should be the subject matter the user wants the video to be about. Capture any additional instructions within the theme.

    User request: "${prompt}"

    Return the result as a JSON object matching the provided schema. Do not include any other text, explanations, or markdown formatting.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: generationPrompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: configSchema,
            },
        });
        const jsonStr = response.text.trim();
        const parsed = JSON.parse(jsonStr);
        return parsed as VideoConfig & { theme: string };
    } catch (error) {
        console.error("Error parsing prompt for config:", error);
        throw new Error("Failed to understand the video requirements from the prompt.");
    }
}


export async function conductResearch(theme: string): Promise<ResearchResult> {
    const prompt = `Conduct a thorough and factual research on the topic: "${theme}".
    Synthesize the findings into a concise, well-structured summary of about 150-200 words.
    Focus on key facts, important figures, and significant events.
    Ensure the information is accurate and from reliable sources.
    This summary will be used to create a video script, so make it engaging and informative.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }],
            },
        });

        const summary = response.text;
        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        
        // FIX: Cast groundingChunks to any[] to ensure correct type inference for the reduce method.
        const sources = (groundingChunks as any[]).reduce((acc, chunk) => {
            if (chunk.web && chunk.web.uri && chunk.web.title) {
                acc.push({ uri: chunk.web.uri, title: chunk.web.title });
            }
            return acc;
        }, [] as { uri: string; title: string; }[]);

        const uniqueSources = Array.from(new Map(sources.map(s => [s.uri, s])).values());

        if (!summary) {
            throw new Error("API did not return a research summary.");
        }

        return { summary, sources: uniqueSources };
    } catch(error) {
        console.error("Error conducting research:", error);
         if (error instanceof Error) {
             throw new Error(`Failed to communicate with the AI model for research. ${error.message}`);
        }
        throw new Error("Failed to communicate with the AI model for research.");
    }
}

export async function generateScript(theme: string, duration: number, researchSummary: string): Promise<Omit<ScriptSegment, 'id'>[]> {
    const prompt = `You are a professional video scriptwriter. Based on the following research summary, create a detailed script for a short video (about ${duration} seconds long) on the theme: "${theme}".
    
    RESEARCH SUMMARY:
    ---
    ${researchSummary}
    ---

    The video should be engaging and flow logically. Break it down into a number of scenes appropriate for the duration (e.g., a 60-second video might have 8-12 scenes).
    For each scene, provide:
    1.  'timestamp': A short duration, like "00:00 - 00:04".
    2.  'visuals': A very detailed, vivid description suitable for an AI image generator to create a compelling visual. This should be based on the facts from the summary.
    3.  'narration': A concise, single-line narration text for the voiceover. Keep it brief and impactful, drawing from the summary.
    4.  'transition': A professional transition to the next scene (e.g., "Fade to black", "Quick cut to", "Slow dissolve into").
    
    The output MUST be a JSON array of objects matching the provided schema. Do not include any introductory text, backticks, or markdown formatting around the JSON.`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: scriptSchema,
                temperature: 0.8,
            },
        });

        const jsonStr = response.text.trim();
        const parsedScript = JSON.parse(jsonStr);
        if (!Array.isArray(parsedScript)) {
            throw new Error("API did not return a valid array for the script.");
        }
        return parsedScript;
    } catch(error) {
        console.error("Error generating script:", error);
        throw new Error("Failed to communicate with the AI model for script generation.");
    }
}

export async function generateVideoMetadata(theme: string, scriptText: string): Promise<VideoMetadata> {
    const prompt = `Based on the video's theme and full script narration, generate metadata suitable for a YouTube video.

    Video Theme: "${theme}"
    
    Script Narration:
    ---
    ${scriptText}
    ---

    Please generate:
    1. A catchy 'title'.
    2. A detailed 'description'.
    3. A list of timestamped 'chapters' that align with the flow of the script. The first timestamp should be "00:00".
    4. A list of relevant 'tags'.

    The output MUST be a JSON object matching the provided schema. Do not include any introductory text, backticks, or markdown formatting.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: videoMetadataSchema,
            },
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch(error) {
        console.error("Error generating video metadata:", error);
        throw new Error("Failed to communicate with the AI model for video metadata.");
    }
}

export async function generateMusicSuggestion(scriptText: string): Promise<MusicSuggestion> {
    const prompt = `Analyze the tone, mood, and content of the following video script's narration. Based on your analysis, suggest a suitable background music.

    SCRIPT NARRATION:
    ---
    ${scriptText}
    ---
    
    Respond with only a JSON object matching the provided schema. Do not include any other text or formatting.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: musicSuggestionSchema,
            },
        });
        const jsonStr = response.text.trim();
        return JSON.parse(jsonStr);
    } catch (error) {
        console.error("Error generating music suggestion:", error);
        // Return a fallback suggestion on error
        return { mood: "Neutral", genre: "Ambient" };
    }
}

export async function selectMusicTrack(theme: string, suggestion: MusicSuggestion): Promise<MusicTrack | null> {
    const trackListForPrompt = musicLibrary.map(t =>
        `ID: "${t.id}", Title: "${t.title}", Genre: "${t.genre}", Moods: [${t.moods.join(', ')}]`
    ).join('\n');

    const prompt = `You are an expert music supervisor for videos.
    Based on the video's theme and the desired musical tone, select the single best background track from the following list.
    
    Video Theme: "${theme}"
    Desired Music Tone: Mood should be "${suggestion.mood}", Genre can be around "${suggestion.genre}".

    Available Tracks:
    ---
    ${trackListForPrompt}
    ---
    
    Respond with only a JSON object containing the 'trackId' of your chosen track and a brief 'reasoning'.
    The output MUST be a JSON object matching the provided schema. Do not include any introductory text, backticks, or markdown formatting around the JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: musicSelectionSchema,
            },
        });
        const jsonStr = response.text.trim();
        const result = JSON.parse(jsonStr);
        const selectedTrack = musicLibrary.find(t => t.id === result.trackId);
        return selectedTrack || musicLibrary[0];
    } catch (error) {
        console.error("Error selecting music track:", error);
        // Fallback: simple keyword matching if AI fails
        const keywords = [suggestion.mood.toLowerCase(), suggestion.genre.toLowerCase()];
        return musicLibrary.find(t => keywords.some(k => t.genre.toLowerCase().includes(k) || t.moods.some(m => m.includes(k)))) || musicLibrary[0];
    }
}

export async function generateVisual(description: string): Promise<string> {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    const basePrompt = `A cinematic, high-quality, photorealistic image representing: ${description}`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Slightly alter prompt on retry to potentially bypass safety filters or ambiguity issues
            const prompt = attempt > 1 
                ? `Style: cinematic, photorealistic. A visually compelling, high-quality image of: ${description}.`
                : basePrompt;
                
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image',
                contents: {
                  parts: [{ text: prompt }],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });
            
            const parts = response.candidates?.[0]?.content?.parts;

            if (parts) {
                for (const part of parts) {
                    if (part.inlineData) {
                      const base64ImageBytes: string = part.inlineData.data;
                      return `data:image/png;base64,${base64ImageBytes}`;
                    }
                }
            }
            
            const finishReason = response.candidates?.[0]?.finishReason;
            lastError = new Error(`No image data received from the API. Finish reason: ${finishReason}`);
            console.warn(`Attempt ${attempt}: ${lastError.message}. Retrying... Response:`, JSON.stringify(response, null, 2));

        } catch(error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`Attempt ${attempt}: Error generating visual:`, lastError);
        }

        if (attempt < MAX_RETRIES) {
            // Exponential backoff
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
    }
    
    console.error("Failed to generate visual after multiple retries. Last error:", lastError);
    throw new Error(`Failed to generate visual after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
}

export async function generateVoiceover(text: string, voiceName: string = 'Puck'): Promise<string> {
    const MAX_RETRIES = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `Say with a professional and engaging tone: ${text}` }] }],
                config: {
                  responseModalities: [Modality.AUDIO],
                  speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: voiceName },
                      },
                  },
                },
            });
            
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

            if (base64Audio) {
                return base64Audio;
            }

            lastError = new Error("No audio data received from the API.");
            console.warn(`Attempt ${attempt}: ${lastError.message}. Retrying...`);

        } catch(error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.error(`Attempt ${attempt}: Error generating voiceover:`, lastError);
        }
        
        if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
        }
    }

    console.error("Failed to generate voiceover after multiple retries. Last error:", lastError);
    throw new Error(`Failed to generate voiceover after ${MAX_RETRIES} attempts. Last error: ${lastError?.message || 'Unknown error'}`);
}
