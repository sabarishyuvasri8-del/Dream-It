// gcal.tsx
// Module for interacting with Google Calendar API

import * as kv from "./kv_store.tsx";

interface GCalEventInput {
  title: string;
  description?: string;
  startTimeIso: string;
  endTimeIso: string;
}

export async function createCalendarEvent(userId: string, event: GCalEventInput): Promise<{ success: boolean; eventLink?: string; error?: string }> {
  try {
    // Attempt to load user-specific token from KV, fallback to environment variable (for simple hackathon demo)
    let token = await kv.get(`gcal_token:${userId}`);
    if (!token) {
      token = Deno.env.get("GOOGLE_CALENDAR_ACCESS_TOKEN");
    }

    if (!token) {
      return { success: false, error: "No Google Calendar access token configured for this user." };
    }

    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        summary: event.title,
        description: event.description || "",
        start: { dateTime: event.startTimeIso },
        end: { dateTime: event.endTimeIso },
      })
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Google Calendar API error:", err);
      return { success: false, error: `Calendar API failed: ${res.statusText}` };
    }

    const data = await res.json();
    return { success: true, eventLink: data.htmlLink };
  } catch (error: any) {
    return { success: false, error: error.message || "Unknown GCal error" };
  }
}
