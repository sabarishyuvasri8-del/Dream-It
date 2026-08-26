// slack.tsx
// Module for posting to Slack via Webhooks.

export async function sendSlackDigest(message: string): Promise<boolean> {
  const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
  if (!webhookUrl) {
    console.log("Slack integration skipped: SLACK_WEBHOOK_URL is not configured.");
    return false;
  }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: message
      }),
    });

    if (!res.ok) {
      console.warn("Slack webhook failed:", await res.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error("Slack integration error:", error);
    return false;
  }
}
