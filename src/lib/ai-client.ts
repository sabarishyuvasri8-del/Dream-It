/**
 * ai-client.ts
 * Centralized utility for handling AI API interactions across Dream It applications.
 */

export interface AIChatMessage {
  role: string;
  content: string;
}

export interface AIChatRequest {
  model: string;
  messages: AIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  onChunk?: (text: string) => void;
}

export interface AIResponse {
  content: string;
  error?: string;
  isRateLimited?: boolean;
}

/**
 * Fetches a response from the Gemini/Gemma models.
 * Automatically handles API key retrieval, fallback obfuscation, and rate limit errors.
 * Supports Server-Sent Events (SSE) streaming if onChunk is provided.
 */
export async function fetchAI(params: AIChatRequest): Promise<AIResponse> {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
  
  // Robust fallback: if envKey is missing, empty, literal "undefined", or a placeholder, use obfuscated key.
  const apiKey = (!envKey || envKey === "undefined" || envKey === "your_api_key_here") 
    ? atob("QVEuQWI4Uk42SktqbEJ5NkdFX2tnTmNrckJXOE5icUh0d01wR1hJWHJPS1pPQWlDb1F5UHc=") 
    : envKey;

  if (!apiKey) {
    return { content: "", error: "API Key is missing or invalid." };
  }

  try {
    const res = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 2048,
        top_p: params.top_p,
        stream: !!params.onChunk,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return { 
          content: "", 
          error: "The AI service is temporarily busy (Rate Limited). Please wait about 30 seconds and try again.", 
          isRateLimited: true 
        };
      }
      return { content: "", error: `API connection error: ${res.status} ${res.statusText}` };
    }

    if (params.onChunk && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            if (line.trim() === "data: [DONE]") continue;
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                const textChunk = data.choices?.[0]?.delta?.content;
                if (textChunk) {
                  fullContent += textChunk;
                  params.onChunk(textChunk);
                }
              } catch (e) {
                // Ignore parsing errors for incomplete JSON chunks
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      return { content: fullContent.trim() };
    } else {
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      
      if (!content) {
        return { content: "", error: "The AI returned an empty response. Please try asking again." };
      }
      return { content };
    }
  } catch (error: any) {
    console.error("AI client fetch network error:", error);
    return { content: "", error: "Failed to connect to the AI service. Please check your network connection." };
  }
}
