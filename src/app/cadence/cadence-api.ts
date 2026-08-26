/**
 * cadence-api.ts
 * Stateless utility file for Cadence speech analysis.
 * Uses the Gemini API for all AI features.
 */

const envKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
const GEMINI_API_KEY = (!envKey || envKey === "undefined" || envKey === "your_api_key_here") ? atob("QVEuQWI4Uk42TGlwTzJackMwYmhhc21yOEQ0MF9HWHNjV0ZnY3VfamVoZ3h0Um9qSUpLSXc=") : envKey;
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_MODEL = "gemini-3.6-flash";

export interface Subsystems {
  phonation: number;
  prosody: number;
  articulation: number;
  rate: number;
}

export interface Biomarker {
  name: string;
  value: number;
  percentile: number;
}

export interface CadenceResponse {
  score: number;
  confidence: number;
  subsystems: Subsystems;
  biomarkers: Biomarker[];
  narrative: string;
  pdf_base64: string;
  ai_reading_analysis?: string;
  transcript?: string;
}

/* ═══════════════════════════════════════════════════════════════════
   35 READING PASSAGES — one is randomly chosen per screening
   ═══════════════════════════════════════════════════════════════════ */
export const READING_PASSAGES: string[] = [
  // 1 — Rainbow Passage (classic clinical)
  "When the sunlight strikes raindrops in the air, they act like a prism and form a rainbow. The rainbow is a division of white light into many beautiful colors.",
  // 2
  "The north wind and the sun had a quarrel about which of them was the stronger. While they were disputing with much heat and bluster, a traveler passed along the road wrapped in a cloak.",
  // 3
  "You wished to know all about my grandfather. Well, he is nearly ninety-three years old. He dresses himself in an old black frock coat, usually with several buttons missing.",
  // 4
  "A boy and his dog went for a walk in the park. The sun was shining, and the birds were singing happily in the tall green trees. They sat down near a pond to rest.",
  // 5
  "The quick brown fox jumps over the lazy dog near the river bank. This sentence contains every letter of the alphabet and is commonly used for testing purposes.",
  // 6
  "Science is a way of thinking much more than it is a body of knowledge. The beauty of a living thing is not the atoms that go into it, but the way those atoms are put together.",
  // 7
  "Education is the most powerful weapon which you can use to change the world. It is through education that the daughter of a peasant can become a doctor.",
  // 8
  "The ocean is a vast body of saltwater that covers more than seventy percent of the Earth's surface. It is home to countless species of marine life, from tiny plankton to enormous whales.",
  // 9
  "In a small village nestled between two mountains, there lived a baker who made the finest bread in the land. People would travel from far and wide just to taste his freshly baked loaves.",
  // 10
  "Technology has transformed the way we communicate, learn, and work. Smartphones and computers have become essential tools in our daily lives, connecting us to information and people around the globe.",
  // 11
  "The library was quiet except for the soft rustling of pages being turned. Students sat at wooden desks, their heads bent over thick textbooks, preparing for their upcoming examinations.",
  // 12
  "Music has the power to bring people together regardless of their background or language. A simple melody can evoke powerful emotions and transport listeners to another time and place entirely.",
  // 13
  "Plants need sunlight, water, and nutrients from the soil to grow healthy and strong. Through the process of photosynthesis, they convert carbon dioxide and water into oxygen and glucose.",
  // 14
  "The history of mathematics is a story of human curiosity and creativity. From counting stones in ancient times to solving complex equations today, numbers have shaped our understanding of the universe.",
  // 15
  "Good communication skills are essential for success in both personal and professional life. Being able to express your thoughts clearly and listen attentively to others builds strong relationships.",
  // 16
  "The rain fell steadily throughout the afternoon, creating small puddles on the cobblestone streets. Children pressed their noses against the window glass, watching the drops race each other down the pane.",
  // 17
  "Space exploration has revealed many wonders about our solar system and beyond. Astronauts have walked on the moon, and robotic probes have visited distant planets to gather valuable scientific data.",
  // 18
  "Reading books regularly can significantly improve vocabulary, comprehension, and critical thinking skills. It opens doors to new worlds, ideas, and perspectives that enrich our understanding of life.",
  // 19
  "The human body is an incredible machine made up of trillions of cells working together in harmony. Each organ performs a specific function that contributes to keeping us alive and healthy.",
  // 20
  "Cooking is both an art and a science that requires patience, practice, and creativity. A skilled chef knows how to balance flavors, textures, and colors to create a memorable dining experience.",
  // 21
  "Climate change is one of the most pressing challenges facing our generation today. Rising temperatures, melting glaciers, and extreme weather events remind us of the urgent need for sustainable solutions.",
  // 22
  "The first rays of dawn painted the sky in shades of pink and gold. Birds began their morning chorus as the world slowly awakened to the promise of a brand new day.",
  // 23
  "Learning a new language opens up a world of opportunities for travel, career growth, and cultural understanding. It challenges the brain and helps develop stronger memory and problem-solving abilities.",
  // 24
  "The ancient Egyptians built magnificent pyramids that still stand tall in the desert sand. These remarkable structures were constructed thousands of years ago as tombs for the powerful pharaohs.",
  // 25
  "Volunteering in your community is a wonderful way to make a positive difference in the lives of others. It helps build empathy, leadership skills, and a deeper connection to the people around you.",
  // 26
  "Water is essential for all forms of life on Earth. Every living organism, from the smallest bacterium to the largest elephant, depends on water for survival, growth, and reproduction.",
  // 27
  "The autumn leaves turned brilliant shades of red, orange, and yellow before drifting gently to the ground. Squirrels scurried about, gathering acorns and preparing their nests for the coming winter.",
  // 28
  "Teamwork is the ability to work together toward a common vision and to direct individual accomplishments toward organizational objectives. It is the fuel that allows ordinary people to attain extraordinary results.",
  // 29
  "The invention of the printing press by Gutenberg in the fifteenth century revolutionized the spread of knowledge. Books became more accessible, and literacy rates began to rise across Europe.",
  // 30
  "Healthy eating habits formed during childhood often last a lifetime. Choosing fruits, vegetables, whole grains, and lean proteins over processed foods gives the body the fuel it needs to thrive.",
  // 31
  "The stars twinkled brightly against the dark velvet sky as a gentle breeze whispered through the tall grass. An owl hooted somewhere in the distance, adding to the peaceful atmosphere of the night.",
  // 32
  "Public speaking is a skill that can be developed with practice and determination. By organizing your thoughts, maintaining eye contact, and speaking with confidence, you can captivate any audience.",
  // 33
  "Friendship is one of the most valuable treasures in life. True friends support each other through difficult times, celebrate successes together, and accept one another without judgment.",
  // 34
  "The bicycle is one of the most efficient forms of transportation ever invented. It requires no fuel, produces no pollution, and provides excellent exercise for people of all ages.",
  // 35
  "Every great achievement in history began with a single step of courage and determination. Whether it was exploring new continents or inventing groundbreaking technology, bold action has always driven human progress.",
];

/** Pick a random passage for the screening session */
export function getRandomPassage(): string {
  return READING_PASSAGES[Math.floor(Math.random() * READING_PASSAGES.length)];
}

/**
 * Helper: call Gemini chat completion
 */
async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 2048,
  temperature: number = 0.3
): Promise<string> {
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GEMINI_API_KEY.trim()}`,
    },
    body: JSON.stringify({
      model: GEMINI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Gemini API error:", res.status, errText);
    if (res.status === 429) {
      throw new Error("RATE_LIMIT");
    }
    throw new Error(`Gemini API error (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

/**
 * Generates a comprehensive AI-powered speech analysis report.
 * Uses the user's live transcript from SpeechRecognition to evaluate
 * reading accuracy, fluency, and speaking ability.
 */
export async function generateSpeechReport(
  transcript: string,
  passage: string
): Promise<CadenceResponse> {
  const hasTranscript = transcript && transcript.trim().length > 0;

  const systemPrompt = `You are a clinical speech-language pathologist AI. You analyze speech recordings by comparing the patient's spoken transcript against a reference passage.

You MUST respond with ONLY a valid JSON object. Do NOT wrap it in markdown code fences. Do NOT add any text before or after the JSON. The JSON must match this schema:

{"score":NUMBER,"confidence":NUMBER,"subsystems":{"phonation":NUMBER,"prosody":NUMBER,"articulation":NUMBER,"rate":NUMBER},"biomarkers":[{"name":"STRING","value":NUMBER,"percentile":NUMBER}],"narrative":"STRING"}

Rules for scoring:
- score: 0-100 overall speech quality
- confidence: 0.0-1.0 your confidence level  
- subsystems: each 0-100
- biomarkers: include Word Accuracy Rate (percentage of words matched), Speaking Pace (words per minute estimate), Fluency Score (0-100), Articulation Clarity (0-100)
- narrative: 4-6 detailed sentences. Be specific about which words were missed, mispronounced, or added. Comment on fluency, pace, and clarity. Give actionable improvement advice.

CRITICAL: If transcript is empty or "NO_SPEECH", all scores must be 5-15 (very low) and narrative must explain no speech was detected.`;

  const userMessage = hasTranscript
    ? `REFERENCE PASSAGE: "${passage}"

PATIENT TRANSCRIPT: "${transcript}"

Analyze word-by-word and provide the JSON report.`
    : `REFERENCE PASSAGE: "${passage}"

PATIENT TRANSCRIPT: NO_SPEECH (the patient did not speak during the recording)

Provide the JSON report reflecting zero speech detected.`;

  try {
    const rawResponse = await callGemini(systemPrompt, userMessage, 2048, 0.15);
    
    // Parse JSON — strip markdown fences if Gemini wraps them
    let jsonStr = rawResponse;
    const fenceMatch = rawResponse.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      jsonStr = fenceMatch[1].trim();
    }
    // Also try to find first { to last }
    const firstBrace = jsonStr.indexOf("{");
    const lastBrace = jsonStr.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      jsonStr = jsonStr.substring(firstBrace, lastBrace + 1);
    }
    
    const parsed = JSON.parse(jsonStr);
    
    return {
      score: parsed.score ?? 0,
      confidence: parsed.confidence ?? 0,
      subsystems: parsed.subsystems ?? { phonation: 0, prosody: 0, articulation: 0, rate: 0 },
      biomarkers: parsed.biomarkers ?? [],
      narrative: parsed.narrative ?? "Unable to generate narrative.",
      pdf_base64: "",
      ai_reading_analysis: parsed.narrative,
      transcript: hasTranscript ? transcript : "",
    };
  } catch (err: any) {
    console.error("Failed to generate speech report:", err);
    
    if (err.message === "RATE_LIMIT") {
      return {
        score: 0,
        confidence: 0,
        subsystems: { phonation: 0, prosody: 0, articulation: 0, rate: 0 },
        biomarkers: [],
        narrative: "The AI service is temporarily busy (rate limited). Please wait 30 seconds and try again.",
        pdf_base64: "",
        ai_reading_analysis: "Rate limited — please wait and retry.",
        transcript: hasTranscript ? transcript : "",
      };
    }
    
    return {
      score: 0,
      confidence: 0,
      subsystems: { phonation: 0, prosody: 0, articulation: 0, rate: 0 },
      biomarkers: [],
      narrative: "Analysis failed. Please ensure your microphone is working and try again.",
      pdf_base64: "",
      ai_reading_analysis: "Could not analyze speech. The AI service encountered an error.",
      transcript: "",
    };
  }
}

/**
 * Submits the three audio tasks to the Cadence FastAPI backend.
 * Falls back to AI-only analysis when backend is unavailable.
 */
export async function submitScreening(
  vowelBlob: Blob,
  readingBlob: Blob,
  ddkBlob: Blob,
  language: string = "en",
  readingTranscript: string = "",
  passage: string = ""
): Promise<CadenceResponse> {
  const apiUrl = (import.meta.env.VITE_CADENCE_API_URL as string) || "http://localhost:8000";

  const formData = new FormData();
  formData.append("vowel", vowelBlob, "vowel.wav");
  formData.append("reading", readingBlob, "reading.wav");
  formData.append("ddk", ddkBlob, "ddk.wav");
  formData.append("language", language);

  try {
    const response = await fetch(`${apiUrl}/api/screen`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    return await response.json() as CadenceResponse;
  } catch (err) {
    console.warn("Backend not reachable. Using AI-powered analysis instead.", err);
    return generateSpeechReport(readingTranscript, passage);
  }
}

/**
 * Speech Coach chat: sends a message to the AI coach with full context
 * of the user's speech analysis results.
 */
export async function chatWithSpeechCoach(
  userMessage: string,
  report: CadenceResponse,
  chatHistory: { role: string; content: string }[]
): Promise<string> {
  const systemPrompt = `You are Speech Coach AI — a warm, expert speech-language pathologist assistant.

You have access to the patient's latest speech screening results:
- Overall Score: ${report.score}/100
- Subsystems: Phonation ${report.subsystems.phonation}, Prosody ${report.subsystems.prosody}, Articulation ${report.subsystems.articulation}, Rate ${report.subsystems.rate}
- Clinical Narrative: ${report.narrative}
${report.transcript ? `- What the patient actually said: "${report.transcript}"` : "- No transcript was captured (patient may not have spoken)."}

YOUR ROLE:
- Answer questions about the patient's speech performance using their ACTUAL data above.
- Provide specific, actionable exercises and tips for improvement.
- Reference specific words or patterns from their transcript when relevant.
- If they ask about a specific aspect (e.g. articulation), dig deep into that area.
- Be encouraging but honest. Never fabricate data or scores not in the report.
- Use clear formatting with bullet points and short paragraphs.
- Suggest specific tongue twisters, breathing exercises, or reading practice when appropriate.`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...chatHistory.slice(-10).map(m => ({ role: m.role, content: m.content })),
    { role: "user", content: userMessage },
  ];

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GEMINI_API_KEY.trim()}`,
      },
      body: JSON.stringify({
        model: GEMINI_MODEL,
        messages,
        max_tokens: 2048,
        temperature: 0.4,
      }),
    });

    if (!res.ok) {
      if (res.status === 429) {
        return "The AI service is temporarily busy. Please wait about 30 seconds and try again.";
      }
      throw new Error(`API error ${res.status}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || "I couldn't generate a response. Please try again.";
  } catch (error) {
    console.error("Speech Coach chat error:", error);
    return "Failed to connect to the AI coach. Please check your connection and try again.";
  }
}
