import { GoogleGenAI, Type, Modality, FunctionDeclaration } from "@google/genai";
import { ScriptSegment, MusicSuggestion, MusicTrack, VideoMetadata, VideoConfig, ChatMessage, ToolCall, ScriptSegmentV2 } from '../types';
import { musicLibrary } from "../data/music";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const availableVoices = ['Puck', 'Kore', 'Zephyr', 'Fenrir', 'Charon'];
const voiceDescription = `The voice for the narration. Select the best fit based on the user's preference and scene content.
- Puck: A crisp, clear, and professional male voice. Great for explainers.
- Kore: A warm, engaging, and professional female voice. Ideal for storytelling.
- Zephyr: A calm, deep, and soothing male voice. Perfect for relaxing or serious topics.
- Fenrir: An energetic, bright, and upbeat female voice. Excellent for ads and dynamic content.
- Charon: A very deep, resonant, and authoritative male voice. Best for cinematic or dramatic impact.
For conversational scripts, you can alternate between different voices.`;

const scriptSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        timestamp: { type: Type.STRING, description: 'Timestamp for the segment, e.g., "00:00 - 00:05".' },
        visuals: { type: Type.STRING, description: 'Detailed description of the visuals for a static image.' },
        narration: { type: Type.STRING, description: 'The narration/voiceover text for this segment. Must be a single, concise line.' },
        transition: { type: Type.STRING, description: 'The transition to the next scene, e.g., "Cut to", "Fade out", "Wipe left".' },
        voice: { type: Type.STRING, description: voiceDescription, enum: availableVoices },
      },
      required: ['timestamp', 'visuals', 'narration', 'transition', 'voice'],
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
            },
            subtitles: { type: Type.BOOLEAN, description: 'Whether to include on-screen captions/subtitles. Default to true unless the user explicitly asks for none.' },
            voicePreference: { type: Type.STRING, description: 'A summary of the user\'s voice preference. E.g., "a single deep male voice", "two alternating voices, one male one female", "a cheerful female voice". Default to "a single clear voice".' },
            voiceStyle: { type: Type.STRING, description: 'The desired style of the narration. E.g., "longer voice over" for detailed content, or "concise" for brief content. Default to "standard".', enum: ['concise', 'standard', 'longer voice over'] },
            stylePreference: { type: Type.STRING, description: 'The overall visual style or mood. E.g., "energetic and flashy", "calm and minimalist", "professional and clean", "cinematic". Default to "standard".'}
        },
        required: ['theme', 'duration', 'aspectRatio', 'subtitles', 'voicePreference', 'voiceStyle', 'stylePreference']
    };

    const generationPrompt = `Analyze the following user request for a video. Extract the core theme and configuration settings.
    - Aspect Ratio: If "short video", "tiktok", "reels", "shorts" or "vertical" is mentioned, use 9:16. If "youtube", "widescreen", "cinematic", use 16:9. If "instagram" or "square", use 1:1. Default is 16:9.
    - Duration: Convert minutes to seconds. Default is 30 seconds.
    - Theme: The subject matter and any specific instructions.
    - Subtitles: Default to true unless the user says "no subtitles", "no captions", etc.
    - Voice Preference: Note if the user wants one voice, two voices, or describes a voice (e.g., "deep male voice"). Default is "a single clear voice".
    - Voice Style: Note if the user wants a "longer voice over" or a "concise" video. Default is "standard".
    - Style Preference: Infer the overall mood or visual style. Look for keywords like "energetic", "calm", "professional", "cinematic", "flashy", "minimalist". Default is "standard".

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
        
        const sources = (groundingChunks as any[]).reduce<{ uri: string; title: string; }[]>((acc, chunk) => {
            if (chunk.web && chunk.web.uri && chunk.web.title) {
                acc.push({ uri: chunk.web.uri, title: chunk.web.title });
            }
            return acc;
        }, []);

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

export async function generateScript(theme: string, config: VideoConfig, researchSummary: string): Promise<Omit<ScriptSegment, 'id'>[]> {
    const instruction = "All visuals should be for static images.";

    const prompt = `You are a professional video scriptwriter. Based on the following research summary and user preferences, create a detailed script for a short video (about ${config.duration} seconds long) on the theme: "${theme}".
    
    RESEARCH SUMMARY:
    ---
    ${researchSummary}
    ---

    USER PREFERENCES:
    - Narration Style: ${config.voiceStyle || 'standard'}. If "longer voice over", write more descriptive narration. If "concise", keep it brief.
    - Voice Preference: ${config.voicePreference || 'a single clear voice'}.
    - Video Style: ${config.stylePreference || 'standard'}. This should influence your choice of transitions. For "energetic", use "Quick cut to". For "calm", use "Slow dissolve into". For "cinematic", use "Fade to black".

    The video should be engaging and flow logically. Break it down into a number of scenes appropriate for the duration.
    For each scene, provide:
    1.  'timestamp': A short duration, like "00:00 - 00:04".
    2.  'visuals': A very detailed, vivid, and factually accurate description suitable for an AI image generator. ${instruction}
    3.  'narration': A concise, single-line narration text for the voiceover. Keep it brief and impactful, drawing from the summary.
    4.  'transition': A professional transition to the next scene (e.g., "Fade to black", "Quick cut to", "Slow dissolve into"). Choose based on the Video Style preference.
    5.  'voice': ${voiceDescription}. Select and assign the most appropriate voice(s) based on the user's preference. If two voices are requested, alternate them between scenes.
    
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

export async function parseUserScript(scriptText: string): Promise<Omit<ScriptSegment, 'id'>[]> {
    const prompt = `You are a script parsing assistant. Your task is to convert a user-provided script into a structured JSON format.

    **CRITICAL INSTRUCTIONS:**
    1.  **DO NOT MODIFY CONTENT:** You MUST preserve the user's original text for 'visuals' and 'narration' exactly as they provided it.
    2.  **PARSE STRUCTURE:** The user will provide a script with scenes. For each scene, extract the content for 'visuals' and 'narration'. Look for speaker cues (e.g., "Joe:", "Jane:") to identify different speakers.
    3.  **GENERATE METADATA:** Generate appropriate 'timestamp', 'transition', and 'voice' values. Estimate duration from narration length. For the voice, choose from the available options. If you detect multiple speakers, assign different voices to them consistently.

    USER SCRIPT:
    ---
    ${scriptText}
    ---

    The output MUST be a JSON array of objects matching the provided schema. Do not include any introductory text, backticks, or markdown formatting around the JSON.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: scriptSchema,
            },
        });

        const jsonStr = response.text.trim();
        const parsedScript = JSON.parse(jsonStr);
        if (!Array.isArray(parsedScript)) {
            throw new Error("API did not return a valid array for the script.");
        }
        return parsedScript;
    } catch(error) {
        console.error("Error parsing user script:", error);
        throw new Error("Failed to communicate with the AI model for script parsing.");
    }
}

const elementAnimationSchema = {
    type: Type.OBJECT,
    properties: {
        type: { type: Type.STRING, enum: ['fade-in', 'slide-in-left', 'slide-in-right', 'slide-in-top', 'slide-in-bottom', 'zoom-in', 'zoom-out', 'scale-up', 'rotate-in'] },
        start: { type: Type.NUMBER, description: 'Animation start time in seconds, relative to the scene start.' },
        duration: { type: Type.NUMBER, description: 'Animation duration in seconds.' },
        exit: {
            type: Type.OBJECT,
            properties: {
                type: { type: Type.STRING, enum: ['fade-out', 'slide-out-left', 'slide-out-right', 'slide-out-top', 'slide-out-bottom', 'zoom-out'] },
                start: { type: Type.NUMBER, description: 'Exit animation start time in seconds, relative to the scene start.' },
                duration: { type: Type.NUMBER, description: 'Exit animation duration in seconds.' }
            }
        }
    },
    required: ['type', 'start', 'duration']
};

const sceneElementSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING, description: 'A unique identifier for this element, e.g., "background-1" or "text-title-1".' },
        type: { type: Type.STRING, enum: ['image', 'text'] },
        prompt: { type: Type.STRING, description: 'A detailed prompt for the image generator. Required if type is "image".' },
        text: { type: Type.STRING, description: 'The text content. Required if type is "text".' },
        style: {
            type: Type.OBJECT,
            properties: {
                fontFamily: { type: Type.STRING, description: 'Font family, e.g., "Inter". Default to "Inter".' },
                fontSize: { type: Type.NUMBER, description: 'Font size as a percentage of canvas height (e.g., 5 for 5%).' },
                color: { type: Type.STRING, description: 'Hex color code for the text, e.g., "#FFFFFF".' },
                textAlign: { type: Type.STRING, enum: ['left', 'center', 'right'] },
                verticalAlign: { type: Type.STRING, enum: ['top', 'middle', 'bottom'] },
                fontWeight: { type: Type.STRING, description: 'Font weight, e.g., "400", "700", "900".' }
            }
        },
        layout: {
            type: Type.OBJECT,
            properties: {
                x: { type: Type.NUMBER, description: 'Left position as a percentage (0-100).' },
                y: { type: Type.NUMBER, description: 'Top position as a percentage (0-100).' },
                width: { type: Type.NUMBER, description: 'Width as a percentage (0-100).' },
                height: { type: Type.NUMBER, description: 'Height as a percentage (0-100).' }
            },
            required: ['x', 'y', 'width', 'height']
        },
        animation: elementAnimationSchema
    },
    required: ['id', 'type', 'style', 'layout', 'animation']
};

const scriptV2Schema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING, description: 'A unique identifier for this scene segment, e.g., "scene-1".' },
            narration: { type: Type.STRING, description: 'The narration/voiceover text for this segment. Must be a single, concise line.' },
            voice: { type: Type.STRING, description: voiceDescription, enum: availableVoices },
            elements: {
                type: Type.ARRAY,
                items: sceneElementSchema,
                description: "A list of animated elements for this scene. The first element must be an 'image' that serves as the background."
            }
        },
        required: ['id', 'narration', 'voice', 'elements']
    }
};

export async function generateScriptV2(theme: string, config: VideoConfig, researchSummary: string): Promise<ScriptSegmentV2[]> {
    const prompt = `You are a master motion graphics designer and visual storyteller. Your task is to create a script for a dynamic, animated video (~${config.duration}s) about "${theme}", based on the provided research and user preferences.

    RESEARCH SUMMARY:
    ---
    ${researchSummary}
    ---

    USER PREFERENCES:
    - Narration Style: ${config.voiceStyle || 'standard'}. If "longer voice over", you MUST write significantly more detailed narration.
    - Voice Preference: ${config.voicePreference || 'a single clear voice'}.
    - Video Style: ${config.stylePreference || 'standard'}. This MUST influence your choice of colors, fonts, and animation types. 'Energetic' styles should use faster animations ('slide-in-*', 'scale-up') and brighter colors. 'Calm' styles should use slower animations ('fade-in', 'zoom-in') and a more muted color palette.

    Your design must adhere to these CRITICAL principles:

    1.  **MAXIMUM LEGIBILITY & AESTHETICS:**
        - Backgrounds MUST be visually interesting but non-distracting (e.g., "soft, blurred, abstract gradient in shades of dark blue"). They set the mood.
        - **TEXT LEGIBILITY IS PARAMOUNT.** All text MUST have a very high contrast ratio against its background. For dark backgrounds, use light colors like '#FFFFFF' or '#F0F0F0'. For light backgrounds, use dark colors like '#1A1A1A'.
        - **To GUARANTEE readability**, if a background has varied colors, you MUST place text inside a semi-transparent bounding box (e.g., a style with a background color like 'rgba(0, 0, 0, 0.5)').

    2.  **DYNAMIC COMPOSITION & INFORMATION DENSITY:**
        - Create rich compositions with **multiple text and image elements** to illustrate the narration.
        - Use the 'animation' property to create a **timeline**. Elements MUST appear and disappear within a single scene. An element's 'exit.start' time MUST be greater than its entrance 'start' + 'duration'. Choreograph animations to create a professional, dynamic feel based on the video style.
        - **FOR "longer voice over" style**: This is a strict requirement. The user wants a detailed video. You MUST break the narration into multiple sequential 'text' elements within each scene. Do not show all the text at once. Animate text elements to appear and disappear in sync with the spoken words to present dense information clearly and engagingly. The total narration per scene can be much longer, and you MUST use multiple text elements to display it over the scene's duration.

    For each scene, provide:
    - 'id': A unique ID.
    - 'narration': The voiceover line. For 'longer voice over', this can be a longer sentence or two.
    - 'voice': ${voiceDescription}. Assign voice(s) based on user preference.
    - 'elements': An array of animated elements following all rules above. The first element must be the full-screen background.

    The output MUST be a JSON array matching the schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: scriptV2Schema,
                temperature: 0.8,
            },
        });

        const jsonStr = response.text.trim();
        const parsedScript = JSON.parse(jsonStr);
        if (!Array.isArray(parsedScript)) {
            throw new Error("API did not return a valid array for the V2 script.");
        }
        return parsedScript;
    } catch(error) {
        console.error("Error generating V2 script:", error);
        throw new Error("Failed to communicate with the AI model for V2 script generation.");
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
    
    const basePrompt = `Create a visually stunning, cinematic, high-quality, photorealistic image. Focus on creating a literal and accurate representation of the following description. Pay close attention to the specified objects, their attributes, and the scene's composition to ensure factual accuracy. Description: ${description}.`;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            // Slightly alter prompt on retry to potentially bypass safety filters or ambiguity issues
            const prompt = attempt > 1 
                ? `Style: cinematic, photorealistic. A visually compelling, high-quality, and accurate image of: ${description}. Ensure the output is faithful to the prompt.`
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
                // FIX: Corrected model name from 'gemini-25-flash-preview-tts' to 'gemini-2.5-flash-preview-tts'
                model: "gemini-2.5-flash-preview-tts",
                // The previous prompt was just the raw text, which can sometimes fail.
                // Providing a clear, simple instruction to the model improves reliability,
                // as the model is trained to distinguish instructions from the content to be spoken.
                contents: [{ parts: [{ text: `Narrate the following: "${text}"` }] }],
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

const tools: FunctionDeclaration[] = [
    {
        name: 'change_visual',
        description: 'Change the visual description for a specific scene, which will trigger a new image generation.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                scene_number: { type: Type.INTEGER, description: 'The 1-based index of the scene to change.' },
                new_visual_description: { type: Type.STRING, description: 'A new, detailed description for the visual of the specified scene.' },
            },
            required: ['scene_number', 'new_visual_description'],
        },
    },
    {
        name: 'change_narration',
        description: 'Change the narration text for a specific scene, which will trigger a new voiceover synthesis.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                scene_number: { type: Type.INTEGER, description: 'The 1-based index of the scene to change.' },
                new_narration_text: { type: Type.STRING, description: 'The new narration text for the specified scene.' },
            },
            required: ['scene_number', 'new_narration_text'],
        },
    },
    {
        name: 'add_scene',
        description: 'Add a new scene to the end of the video.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                visual_description: { type: Type.STRING, description: 'A detailed description for the visual of the new scene.' },
                narration_text: { type: Type.STRING, description: 'The narration text for the new scene.' },
                voice: { type: Type.STRING, description: voiceDescription },
            },
            required: ['visual_description', 'narration_text', 'voice'],
        },
    },
    {
        name: 'replace_visual_with_user_image',
        description: 'Replace the visual for a specific scene with an image uploaded by the user. Only use this if the user has indicated they have uploaded an image and want to use it.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                scene_number: { type: Type.INTEGER, description: 'The 1-based index of the scene to change.' },
            },
            required: ['scene_number'],
        },
    },
    {
        name: 'change_background_music',
        description: 'Change the background music for the video. The AI will select a suitable track from a predefined music library based on the user\'s suggestion of a mood or genre.',
        parameters: {
            type: Type.OBJECT,
            properties: {
                mood: { type: Type.STRING, description: 'A new mood for the music, e.g., "upbeat", "dramatic".' },
                genre: { type: Type.STRING, description: 'A new genre for the music, e.g., "cinematic", "lo-fi".' }
            },
            required: [],
        },
    }
];

export async function processChatRequest(
    history: ChatMessage[],
    currentScript: ScriptSegment[]
): Promise<{ text: string, toolCalls: ToolCall[] }> {
    const systemInstruction = `You are a helpful AI video editing assistant. Your goal is to help the user modify a video script by calling the appropriate tools.
The user can change visuals, narration, add new scenes, use an image they have uploaded, or change the background music.
When adding a new scene, you must also specify a voice for the narration.
The script is 1-indexed (Scene 1 is the first scene).
Politely inform the user about the action you are taking. For example, if changing a visual, say "Okay, I'm updating the visual for scene {scene_number}."
If the user wants to use their uploaded image, call the 'replace_visual_with_user_image' tool.
If the user wants to change the background music, use their suggestion of a mood or genre to call the 'change_background_music' tool. The AI will select a suitable track from a predefined high-quality music library.
Here is the current script for context:
${currentScript.map((s, i) => `Scene ${i+1}: "${s.narration}"`).join('\n')}
`;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-pro',
            contents: history,
            config: {
                systemInstruction,
                tools: [{ functionDeclarations: tools }],
            }
        });

        const text = response.text;
        const toolCalls: ToolCall[] = response.functionCalls?.map(fc => ({ name: fc.name, args: fc.args })) || [];
        
        return { text, toolCalls };
    } catch(error) {
        console.error("Error processing chat request:", error);
        return { text: "Sorry, I encountered an error. Please try again.", toolCalls: [] };
    }
}