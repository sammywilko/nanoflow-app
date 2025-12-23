
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { AnalysisResponse, ProjectPlan } from "../types";

// Helper to ensure we always get the latest key from the environment
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

// MODELS
const VISION_MODEL = 'gemini-3-pro-image-preview'; // Nano Banana Pro
const TEXT_MODEL = 'gemini-2.5-flash';

// Helper to handle base64 mime types correctly
const getBase64Parts = (base64String: string) => {
  const match = base64String.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) {
    return { mimeType: match[1], data: match[2] };
  }
  return { mimeType: 'image/png', data: base64String };
};

// Optimization: Resize image before sending to Planning API to reduce token count and latency
const resizeImage = async (base64Str: string, maxWidth = 1024): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8)); // Convert to JPEG with compression
    };
  });
};

// Retry helper for robustness
async function withRetry<T>(fn: () => Promise<T>, retries = 1, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// --- PROJECT WORKFLOW ---

export const planProject = async (brief: string, referenceImages: string[]): Promise<ProjectPlan> => {
    try {
        const ai = getAI();
        const parts: any[] = [];

        // Optimize references: Resize to prevent payload bloat and timeout
        for (const img of referenceImages) {
            const resized = await resizeImage(img);
            const { mimeType, data } = getBase64Parts(resized);
            parts.push({ inlineData: { mimeType, data } });
        }

        parts.push({ text: `
            ROLE: Creative Director.
            TASK: Create a visual project plan.
            BRIEF: "${brief}"
            
            OUTPUT: JSON with:
            1. Theme Name.
            2. Palette (5 hex).
            3. 5 Style Keywords.
            4. Shot List (4 distinct shots: Hero, Detail, Environment, Mood).
            
            ${referenceImages.length > 0 ? 'NOTE: Align concepts with the attached reference images.' : ''}
        `});

        const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
            model: TEXT_MODEL,
            contents: [{ parts }],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        themeName: { type: Type.STRING },
                        palette: { type: Type.ARRAY, items: { type: Type.STRING } },
                        styleKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                        shots: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    title: { type: Type.STRING },
                                    description: { type: Type.STRING },
                                }
                            }
                        }
                    }
                }
            }
        }));

        if (response.text) {
            const data = JSON.parse(response.text);
            return {
                ...data,
                shots: data.shots.map((s: any, i: number) => ({ ...s, id: `shot-${i}-${Date.now()}`, status: 'pending' }))
            } as ProjectPlan;
        }
        throw new Error("Failed to generate plan");

    } catch (error) {
        console.error("Plan Project Error:", error);
        throw error;
    }
};

export const generateProjectShot = async (
    shotDescription: string, 
    styleKeywords: string[], 
    referenceImages: string[],
    aspectRatio: string = "1:1",
    imageSize: "1080p" | "1K" | "2K" | "4K" = "2K"
): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const parts: any[] = [];
        
        referenceImages.forEach(img => {
            const { mimeType, data } = getBase64Parts(img);
            parts.push({ inlineData: { mimeType, data } });
        });

        const prompt = `
            GENERATE: ${shotDescription}
            STYLE: ${styleKeywords.join(", ")}.
            ${referenceImages.length > 0 ? 'IMPORTANT: Maintain strict facial/visual consistency with references.' : ''}
            Quality: High, Photorealistic.
        `;
        parts.push({ text: prompt });

        // Map 1080p to 2K as it's the closest bucket supported by the API
        const apiImageSize = imageSize === "1080p" ? "2K" : imageSize;

        const response = await ai.models.generateContent({
            model: VISION_MODEL,
            contents: [{ parts }],
            config: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: apiImageSize
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        throw new Error("Model returned no image.");
    });
};

export const generateGenericImage = async (
    prompt: string, 
    referenceImages: string[], 
    aspectRatio: string = "1:1",
    imageSize: "1080p" | "1K" | "2K" | "4K" = "2K"
): Promise<string> => {
    return withRetry(async () => {
        const ai = getAI();
        const parts: any[] = [];
        
        referenceImages.forEach(img => {
            const { mimeType, data } = getBase64Parts(img);
            parts.push({ inlineData: { mimeType, data } });
        });

        parts.push({ text: `${prompt}. High quality, detailed.` });

        const apiImageSize = imageSize === "1080p" ? "2K" : imageSize;

        const response = await ai.models.generateContent({
            model: VISION_MODEL,
            contents: [{ parts }],
            config: {
                responseModalities: ['IMAGE'],
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: apiImageSize
                }
            }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData) {
                return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            }
        }
        throw new Error("Model returned no image.");
    });
};


// --- UTILITIES ---

export const analyzeImage = async (base64Data: string): Promise<AnalysisResponse> => {
  try {
    const ai = getAI();
    const { mimeType, data } = getBase64Parts(base64Data);
    const response = await withRetry<GenerateContentResponse>(() => ai.models.generateContent({
      model: TEXT_MODEL,
      contents: [{
        parts: [
          { inlineData: { mimeType, data } },
          { text: "Analyze this image. Extract 5 hex color codes, 5 style keywords, and a 1-sentence description." }
        ]
      }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            colors: { type: Type.ARRAY, items: { type: Type.STRING } },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: { type: Type.STRING }
          }
        }
      }
    }));

    if (response.text) {
      return JSON.parse(response.text) as AnalysisResponse;
    }
    throw new Error("No analysis returned");
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const editImageVariation = async (
    base64Image: string, 
    instruction: string,
    imageSize: "1K" | "2K" | "4K" = "2K"
): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    const { mimeType, data } = getBase64Parts(base64Image);

    const parts = [
      { inlineData: { mimeType, data } },
      { text: `Modify this image: "${instruction}". Maintain high quality.` }
    ];

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [{ parts }], 
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { 
            aspectRatio: "1:1",
            imageSize: imageSize
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No variation generated");
  });
};

export const applyStyleTransfer = async (contentImage: string, styleImage: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    const content = getBase64Parts(contentImage);
    const style = getBase64Parts(styleImage);

    const parts = [
      { text: "Content:" },
      { inlineData: { mimeType: content.mimeType, data: content.data } },
      { text: "Style:" },
      { inlineData: { mimeType: style.mimeType, data: style.data } },
      { text: "Apply the style of the Style image to the Content image." }
    ];

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [{ parts }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { 
            aspectRatio: "1:1",
            imageSize: "2K"
        } 
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No style transfer generated");
  });
};

export const smartCompose = async (images: string[], prompt: string): Promise<string> => {
  return withRetry(async () => {
    const ai = getAI();
    const parts: any[] = [];
    
    images.forEach(img => {
        const { mimeType, data } = getBase64Parts(img);
        parts.push({ inlineData: { mimeType, data } });
    });

    parts.push({ text: `Combine these images into a cohesive scene. User Instruction: "${prompt}". High resolution, photorealistic.` });

    const response = await ai.models.generateContent({
      model: VISION_MODEL,
      contents: [{ parts }],
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: {
            aspectRatio: "16:9",
            imageSize: "2K"
        }
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No composition generated");
  });
};
