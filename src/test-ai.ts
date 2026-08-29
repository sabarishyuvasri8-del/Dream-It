import { fetchAI } from './lib/ai-client.ts';

async function test() {
  const res = await fetchAI({
    model: "gemini-1.5-flash-8b",
    messages: [{ role: "user", content: "Hello" }]
  });
  console.log("Result:", res);
}
test();
