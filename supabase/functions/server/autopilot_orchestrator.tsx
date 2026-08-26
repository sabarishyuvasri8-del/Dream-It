import * as kv from "./kv_store.tsx";
import { createCalendarEvent } from "./gcal.tsx";
import { sendSlackDigest } from "./slack.tsx";

// Define structured schemas matching our frontend models
interface ExtractedItem {
  title: string;
  type: "assignment" | "exam" | "meeting_followup" | "reading";
  subject: string;
  deadline?: string; // ISO date
  priority: "low" | "medium" | "high";
  confidence: number;
}

interface AgentPlanAction {
  actionType: "create_task" | "create_schedule" | "create_subject" | "flag_conflict" | "skip_duplicate";
  description: string;
  payload: any;
  gcalEvent?: boolean;
}

export interface AgentRunLog {
  id: string;
  triggerSource: string;
  timestamp: string;
  extractedItems: ExtractedItem[];
  plan: AgentPlanAction[];
  executionResults: { success: boolean; messages: string[]; errors: string[] };
}

// Stage A: Extraction using Gemini Structured Output
async function extractActionItems(text: string): Promise<ExtractedItem[]> {
  const geminiApiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("VITE_GEMINI_API_KEY") || "your_api_key_here";
  
  const systemPrompt = `You are a strict data extraction agent. Extract actionable items from the user's text (e.g. syllabus, meeting notes). 
Return a JSON array of objects. Each object MUST exactly match this schema:
{
  "title": string,
  "type": "assignment" | "exam" | "meeting_followup" | "reading",
  "subject": string (guess best subject name),
  "deadline": string (ISO 8601 date, or null if none),
  "priority": "low" | "medium" | "high",
  "confidence": number (0 to 1)
}
Return ONLY valid JSON. No markdown wrappers.`;

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${geminiApiKey.trim()}`,
    },
    body: JSON.stringify({
      model: "gemini-3.6-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }, // Attempt to force JSON via OpenAI compatibility layer
      temperature: 0.1
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini Extraction failed: ${await response.text()}`);
  }

  const data = await response.json();
  let content = data.choices?.[0]?.message?.content?.trim() || "[]";
  
  // Strip markdown if the model hallucinates it despite instructions
  if (content.startsWith("```json")) content = content.substring(7);
  if (content.startsWith("```")) content = content.substring(3);
  if (content.endsWith("```")) content = content.substring(0, content.length - 3);
  
  try {
    const parsed = JSON.parse(content);
    // Accommodate if the model wrapped it in an object like { "items": [...] }
    return Array.isArray(parsed) ? parsed : (parsed.items || parsed.extractedItems || []);
  } catch (e) {
    console.error("Failed to parse Gemini output:", content);
    return [];
  }
}

// Stage B: Routing and Planning
async function buildPlan(userId: string, extracted: ExtractedItem[], workspace: any): Promise<AgentPlanAction[]> {
  const plan: AgentPlanAction[] = [];
  const subjects = workspace.subjects || [];
  const tasks = workspace.tasks || [];
  const scheduleItems = workspace.scheduleItems || [];

  for (const item of extracted) {
    // 1. Subject Matching
    let subjectMatch = subjects.find((s: any) => s.name.toLowerCase() === item.subject.toLowerCase());
    if (!subjectMatch && item.subject) {
      plan.push({
        actionType: "create_subject",
        description: `Create missing subject: ${item.subject}`,
        payload: { name: item.subject, color: "var(--m-primary)", accent: "var(--m-primary-text)" }
      });
      // Simulate creation for subsequent item planning
      subjectMatch = { name: item.subject };
      subjects.push(subjectMatch);
    }

    // 2. Duplicate Task Check
    const isDuplicate = tasks.some((t: any) => 
      t.title.toLowerCase() === item.title.toLowerCase() && 
      t.course === item.subject
    );

    if (isDuplicate) {
      plan.push({
        actionType: "skip_duplicate",
        description: `Skipped duplicate task: ${item.title}`,
        payload: { title: item.title }
      });
      continue;
    }

    // 3. Exam/Meeting -> Schedule Item & Google Calendar
    if (item.type === "exam" || item.type === "meeting_followup") {
      if (item.deadline) {
        // Basic overlap check (exact time match)
        const overlap = scheduleItems.some((s: any) => s.time === item.deadline);
        if (overlap) {
          plan.push({
            actionType: "flag_conflict",
            description: `Conflict detected for ${item.title} at ${item.deadline}`,
            payload: { title: item.title, time: item.deadline }
          });
        } else {
          plan.push({
            actionType: "create_schedule",
            description: `Schedule ${item.type}: ${item.title}`,
            gcalEvent: true,
            payload: {
              title: item.title,
              time: item.deadline, // Usually a time string in scheduleItems, but we pass ISO for GCal
              course: item.subject,
              note: `Agent created (${item.priority} priority)`,
              tone: "urgent"
            }
          });
        }
      }
    } else {
      // 4. Assignments/Readings -> Tasks
      plan.push({
        actionType: "create_task",
        description: `Create task: ${item.title}`,
        payload: {
          title: item.title,
          course: item.subject,
          priority: item.priority,
          deadline: item.deadline,
          time: item.deadline ? new Date(item.deadline).toLocaleDateString() : "Anytime"
        }
      });
    }
  }

  return plan;
}

// Execution Loop
async function executePlan(userId: string, plan: AgentPlanAction[], workspace: any) {
  const results = { success: true, messages: [] as string[], errors: [] as string[] };
  
  if (!workspace.tasks) workspace.tasks = [];
  if (!workspace.subjects) workspace.subjects = [];
  if (!workspace.scheduleItems) workspace.scheduleItems = [];

  let tasksCreated = 0;
  let eventsCreated = 0;
  let conflicts = 0;

  for (const action of plan) {
    try {
      if (action.actionType === "create_subject") {
        workspace.subjects.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          ...action.payload
        });
        results.messages.push(`Created subject: ${action.payload.name}`);
      }
      
      if (action.actionType === "create_task") {
        workspace.tasks.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          done: false,
          color: "var(--m-primary)",
          createdBy: "agent",
          ...action.payload
        });
        tasksCreated++;
        results.messages.push(`Created task: ${action.payload.title}`);
      }

      if (action.actionType === "create_schedule") {
        workspace.scheduleItems.push({
          id: Date.now() + Math.floor(Math.random() * 1000),
          done: false,
          createdBy: "agent",
          ...action.payload
        });
        
        // Create GCal Event if flagged
        if (action.gcalEvent && action.payload.time) {
          const endDate = new Date(action.payload.time);
          endDate.setHours(endDate.getHours() + 1); // Mock 1 hour duration
          
          const gcalRes = await createCalendarEvent(userId, {
            title: action.payload.title,
            startTimeIso: action.payload.time,
            endTimeIso: endDate.toISOString()
          });

          if (gcalRes.success) {
            results.messages.push(`Created GCal event for ${action.payload.title}`);
            eventsCreated++;
          } else {
            results.errors.push(`GCal failed for ${action.payload.title}: ${gcalRes.error}`);
          }
        } else {
          eventsCreated++;
        }
      }

      if (action.actionType === "flag_conflict") {
        conflicts++;
        results.messages.push(action.description);
      }

    } catch (e: any) {
      results.errors.push(`Failed to execute ${action.actionType}: ${e.message}`);
    }
  }

  // Save updated workspace
  await kv.set(`workspace:${userId}`, workspace);

  // Send Slack digest
  const summaryMsg = `Autopilot processed your input: created ${tasksCreated} tasks, ${eventsCreated} calendar events, flagged ${conflicts} conflicts.`;
  await sendSlackDigest(summaryMsg);

  return results;
}

// Main Orchestrator Entrypoint
export async function runAutopilot(userId: string, source: string, text: string) {
  const runId = crypto.randomUUID();
  const log: AgentRunLog = {
    id: runId,
    triggerSource: source,
    timestamp: new Date().toISOString(),
    extractedItems: [],
    plan: [],
    executionResults: { success: false, messages: [], errors: [] }
  };

  try {
    // 1. Extraction
    log.extractedItems = await extractActionItems(text);
    if (log.extractedItems.length === 0) {
      log.executionResults.messages.push("No actionable items found.");
      log.executionResults.success = true;
    } else {
      // 2. Planning
      const workspace = (await kv.get(`workspace:${userId}`)) || {};
      log.plan = await buildPlan(userId, log.extractedItems, workspace);

      // 3. Execution
      log.executionResults = await executePlan(userId, log.plan, workspace);
    }
  } catch (error: any) {
    log.executionResults.success = false;
    log.executionResults.errors.push(error.message);
  }

  // 4. Audit Log
  const existingRuns = (await kv.get(`agent_runs:${userId}`)) || [];
  await kv.set(`agent_runs:${userId}`, [log, ...existingRuns].slice(0, 50)); // Keep last 50

  return log;
}
