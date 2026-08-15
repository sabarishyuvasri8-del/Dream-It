import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import * as kv from "./kv_store.tsx";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();
const serverPrefix = "/make-server-d53fe46f";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const ALLOWED_EXTENSIONS = new Set([
  "pdf", "png", "jpg", "jpeg", "gif", "webp", "docx", "doc", "pptx", "xlsx", "txt"
]);

interface AttachedFileMetadata {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  subjectId: number;
  taskId?: number;
  storagePath: string;
  createdAt: string;
}

app.use("*", logger(console.log));
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

app.get(`${serverPrefix}/health`, (c) => c.json({ status: "ok" }));

async function getAuthenticatedUser(c: { req: { header: (name: string) => string | undefined } }) {
  const authorization = c.req.header("Authorization");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  if (!token) return null;
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

function validateFile(fileName: string, mimeType: string, size: number): string | null {
  if (size > MAX_FILE_SIZE) {
    return "File size exceeds the 20MB limit.";
  }
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const isMimeAllowed = ALLOWED_MIME_TYPES.has(mimeType.toLowerCase());
  const isExtAllowed = ALLOWED_EXTENSIONS.has(ext);

  if (!isMimeAllowed && !isExtAllowed) {
    return `File type not supported. Allowed formats: PDF, PNG, JPG, GIF, WEBP, DOCX, DOC, PPTX, XLSX, TXT.`;
  }
  return null;
}

app.get(`${serverPrefix}/workspace`, async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) return c.json({ error: "Sign in is required." }, 401);
  return c.json({ workspace: (await kv.get(`workspace:${user.id}`)) ?? {} });
});

app.put(`${serverPrefix}/workspace`, async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) return c.json({ error: "Sign in is required." }, 401);
  const workspace = await c.req.json();
  if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) return c.json({ error: "Invalid workspace data." }, 400);
  await kv.set(`workspace:${user.id}`, workspace);
  return c.json({ saved: true });
});

app.post(`${serverPrefix}/study-coach`, async (c) => {
  try {
    const user = await getAuthenticatedUser(c);
    if (!user) return c.json({ error: "Sign in is required." }, 401);
    const body = await c.req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const history = Array.isArray(body?.history) ? body.history : [];

    if (!message) {
      return c.json({ error: "A study question is required." }, 400);
    }
    if (message.length > 20000) {
      return c.json({ error: "Please keep messages under 20,000 characters." }, 400);
    }

    const rateKey = `study-coach-rate:${user.id}`;
    const now = Date.now();
    const previous = await kv.get(rateKey) as { count?: number; resetAt?: number } | null;
    const windowState = !previous || !previous.resetAt || previous.resetAt < now
      ? { count: 0, resetAt: now + 5 * 60 * 1000 }
      : previous;

    if ((windowState.count ?? 0) >= 30) {
      return c.json({ error: "Please wait a few minutes before sending more messages." }, 429);
    }
    await kv.set(rateKey, { count: (windowState.count ?? 0) + 1, resetAt: windowState.resetAt });

    const groqApiKey = Deno.env.get("GROQ_API_KEY") || Deno.env.get("VITE_GROQ_API_KEY") || "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";
    
    const systemPrompt = `You are Dream It AI, an expert, encouraging study assistant for students. Help with study planning, course concepts, mathematics step-by-step working, code debugging, and flashcards. Be concise, well-structured, and use markdown formatting.`;

    const formattedMessages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-8).map((m: any) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: String(m.content || ""),
      })),
      { role: "user", content: message },
    ];

    const aiResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey.trim()}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: formattedMessages,
        max_tokens: 4096,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error(`AI service returned ${aiResponse.status}: ${errText.slice(0, 300)}`);
      return c.json({ error: "Dream It AI service is currently busy. Please try again shortly." }, 502);
    }

    const aiData = await aiResponse.json();
    const answer = aiData?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      return c.json({ error: "Dream It AI returned an empty response." }, 502);
    }

    return c.json({ answer });
  } catch (error) {
    console.error("Study coach error:", error instanceof Error ? error.message : "Unknown error");
    return c.json({ error: "An unexpected error occurred while contacting Dream It AI." }, 500);
  }
});

// =========================================
// FILE ATTACHMENTS BACKEND ROUTES
// =========================================

// 1. GET /files - List user's file attachments
app.get(`${serverPrefix}/files`, async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) return c.json({ error: "Sign in is required." }, 401);

  const files = (await kv.get(`files:${user.id}`)) as AttachedFileMetadata[] || [];
  return c.json({ files });
});

// 2. POST /files - Upload file & store metadata
app.post(`${serverPrefix}/files`, async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) return c.json({ error: "Sign in is required." }, 401);

  try {
    let fileName = "";
    let mimeType = "application/octet-stream";
    let size = 0;
    let subjectId = 0;
    let taskId: number | undefined = undefined;
    let fileBuffer: Uint8Array | ArrayBuffer | null = null;

    const contentType = c.req.header("Content-Type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await c.req.formData();
      const file = formData.get("file") as File | null;
      subjectId = Number(formData.get("subjectId") || 0);
      const taskIdVal = formData.get("taskId");
      if (taskIdVal) taskId = Number(taskIdVal);

      if (!file) {
        return c.json({ error: "No file provided in form data." }, 400);
      }

      fileName = file.name;
      mimeType = file.type || "application/octet-stream";
      size = file.size;
      fileBuffer = new Uint8Array(await file.arrayBuffer());
    } else {
      // Base64 JSON Payload support
      const body = await c.req.json();
      fileName = body.fileName || "file";
      mimeType = body.mimeType || "application/octet-stream";
      subjectId = Number(body.subjectId || 0);
      if (body.taskId) taskId = Number(body.taskId);

      if (!body.fileData) {
        return c.json({ error: "No file data provided." }, 400);
      }

      // Convert Base64 to Uint8Array
      const binaryString = atob(body.fileData.replace(/^data:.*?;base64,/, ""));
      size = binaryString.length;
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBuffer = bytes;
    }

    // Validate size and format
    const validationError = validateFile(fileName, mimeType, size);
    if (validationError) {
      return c.json({ error: validationError }, 400);
    }

    const fileId = crypto.randomUUID();
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.\-_]/g, "_");
    const storagePath = `${user.id}/${fileId}-${sanitizedFileName}`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Upload to private "attachments" bucket
    const { error: uploadError } = await admin.storage
      .from("attachments")
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload failed:", uploadError);
      return c.json({ error: `Storage upload failed: ${uploadError.message}` }, 500);
    }

    const meta: AttachedFileMetadata = {
      id: fileId,
      fileName,
      mimeType,
      size,
      subjectId,
      taskId,
      storagePath,
      createdAt: new Date().toISOString(),
    };

    const existingFiles = (await kv.get(`files:${user.id}`)) as AttachedFileMetadata[] || [];
    await kv.set(`files:${user.id}`, [...existingFiles, meta]);

    return c.json({ file: meta }, 201);
  } catch (err: any) {
    console.error("File upload endpoint error:", err);
    return c.json({ error: err.message || "Failed processing file upload." }, 500);
  }
});

// 3. GET /files/:id/url - Generate short-lived signed download URL
app.get(`${serverPrefix}/files/:id/url`, async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) return c.json({ error: "Sign in is required." }, 401);

  const fileId = c.req.param("id");
  const files = (await kv.get(`files:${user.id}`)) as AttachedFileMetadata[] || [];
  const targetFile = files.find((f) => f.id === fileId);

  if (!targetFile) {
    return c.json({ error: "File not found or access denied." }, 404);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Generate 1-hour signed download URL
  const { data, error } = await admin.storage
    .from("attachments")
    .createSignedUrl(targetFile.storagePath, 3600);

  if (error || !data?.signedUrl) {
    console.error("Failed creating signed URL:", error);
    return c.json({ error: "Could not generate download link." }, 500);
  }

  return c.json({ url: data.signedUrl, fileName: targetFile.fileName });
});

// 4. DELETE /files/:id - Delete storage object & KV metadata
app.delete(`${serverPrefix}/files/:id`, async (c) => {
  const user = await getAuthenticatedUser(c);
  if (!user) return c.json({ error: "Sign in is required." }, 401);

  const fileId = c.req.param("id");
  const files = (await kv.get(`files:${user.id}`)) as AttachedFileMetadata[] || [];
  const targetFile = files.find((f) => f.id === fileId);

  if (!targetFile) {
    return c.json({ error: "File not found or access denied." }, 404);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  // Delete object from Supabase storage
  await admin.storage.from("attachments").remove([targetFile.storagePath]);

  // Remove metadata from KV store
  const updatedFiles = files.filter((f) => f.id !== fileId);
  await kv.set(`files:${user.id}`, updatedFiles);

  return c.json({ deleted: true, id: fileId });
});

Deno.serve(app.fetch);

