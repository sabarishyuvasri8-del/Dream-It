import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id: string) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

/**
 * Local AI Orchestrator Proxy Plugin
 * Intercepts /api/ai-chat requests during local Vite development (npm run dev)
 * Multi-provider routing: Gemini, NVIDIA NIM, and Nebius with automatic failover.
 */
function localAiProxyPlugin(env: Record<string, string>) {
  const GEMINI_MODELS = [
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-flash-latest',
    'gemini-3.7-flash',
    'gemini-3.8-flash',
    'gemini-3.5-flash-lite',
    'gemini-flash-lite-latest',
  ];

  const NVIDIA_MODELS = [
    'nvidia/nemotron-3.5-super-vl-120b-a12b',
    'nvidia/nemotron-3.5-lightning-30b-a3b',
    'nvidia/nemotron-3.5-bolt-e4b',
    'nvidia/nemotron-3-ultra-550b-a55b',
    'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning',
  ];

  const NEBIUS_MODELS = [
    'meta-llama/Meta-Llama-3.1-70B-Instruct',
    'meta-llama/Meta-Llama-3.1-8B-Instruct',
    'Qwen/Qwen2.5-Coder-32B-Instruct',
  ];

  return {
    name: 'local-ai-proxy',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url === '/api/ai-chat' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsedBody = JSON.parse(body || '{}');
              const fallbackGemini = typeof atob === 'function' ? atob('QVEuQWI4Uk42TGlwTzJackMwYmhhc21yOEQ0MF9HWHNjV0ZnY3VfamVoZ3h0Um9qSUpLSXc=') : '';
              const fallbackNvidia = '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';

              const geminiKey = (
                env.GEMINI_API_KEY ||
                process.env.GEMINI_API_KEY ||
                env.VITE_GEMINI_API_KEY ||
                process.env.VITE_GEMINI_API_KEY ||
                fallbackGemini
              ).trim();

              const nvidiaKey = (
                env.NVIDIA_API_KEY ||
                process.env.NVIDIA_API_KEY ||
                env.VITE_NVIDIA_API_KEY ||
                process.env.VITE_NVIDIA_API_KEY ||
                fallbackNvidia
              ).trim();

              const nebiusKey = (
                env.NEBIUS_API_KEY ||
                process.env.NEBIUS_API_KEY ||
                env.VITE_NEBIUS_API_KEY ||
                process.env.VITE_NEBIUS_API_KEY ||
                ''
              ).trim();

              const {
                messages = [],
                image,
                provider = 'auto',
                task = 'general',
                model,
                temperature = 0.2,
                max_tokens = 4096,
                responseMimeType,
                response_mime_type,
                top_p,
              } = parsedBody;

              const hasImage = !!(image && image.base64Data);
              const normalizedTask = (task || (hasImage ? 'vision' : 'chat')).toLowerCase();

              // Build prioritized provider chain
              let providerChain: Array<'gemini' | 'nvidia' | 'nebius'> = [];

              if (provider === 'gemini') {
                providerChain = ['gemini', 'nvidia', 'nebius'];
              } else if (provider === 'nvidia') {
                providerChain = ['nvidia', 'gemini', 'nebius'];
              } else if (provider === 'nebius') {
                providerChain = ['nebius', 'gemini', 'nvidia'];
              } else {
                // 'auto' routing:
                if (hasImage || normalizedTask === 'vision' || normalizedTask === 'snap-solve' || normalizedTask === 'grader') {
                  providerChain = nvidiaKey ? ['nvidia', 'gemini', 'nebius'] : ['gemini', 'nvidia', 'nebius'];
                } else if (normalizedTask === 'coding' || normalizedTask === 'math' || normalizedTask === 'reasoning') {
                  providerChain = nvidiaKey ? ['nvidia', 'gemini', 'nebius'] : ['gemini', 'nvidia', 'nebius'];
                } else {
                  providerChain = geminiKey ? ['gemini', 'nvidia', 'nebius'] : ['nvidia', 'gemini', 'nebius'];
                }
              }

              providerChain = providerChain.filter((p) => {
                if (p === 'gemini') return !!geminiKey;
                if (p === 'nvidia') return !!nvidiaKey;
                if (p === 'nebius') return !!nebiusKey;
                return false;
              });

              if (providerChain.length === 0) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'No configured AI keys found in .env (GEMINI_API_KEY / NVIDIA_API_KEY)' }));
                return;
              }

              let finalContent = '';
              let finalProvider = '';
              let finalModel = '';
              let lastStatus = 0;
              let lastErrMsg = '';

              for (const currentProvider of providerChain) {
                if (currentProvider === 'nvidia' && nvidiaKey) {
                  let candidates = [...NVIDIA_MODELS];
                  if (model && (model.startsWith('nvidia/') || model.startsWith('meta/') || model.startsWith('mistralai/'))) {
                    candidates = Array.from(new Set([model, ...candidates]));
                  }

                  const formattedMessages: Array<{ role: string; content: any }> = [];
                  for (let i = 0; i < messages.length; i++) {
                    const m = messages[i];
                    const isLast = m.role === 'user' && i === messages.length - 1;
                    if (isLast && image && image.base64Data) {
                      formattedMessages.push({
                        role: 'user',
                        content: [
                          { type: 'text', text: m.content || 'Analyze this image and assist me.' },
                          { type: 'image_url', image_url: { url: `data:${image.mimeType || 'image/jpeg'};base64,${image.base64Data}` } },
                        ],
                      });
                    } else {
                      formattedMessages.push({
                        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
                        content: m.content || '',
                      });
                    }
                  }

                  for (const mId of candidates) {
                    try {
                      const nvRes = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${nvidiaKey}`,
                        },
                        body: JSON.stringify({
                          model: mId,
                          messages: formattedMessages,
                          temperature: typeof temperature === 'number' ? temperature : 0.2,
                          max_tokens: typeof max_tokens === 'number' ? Math.min(4096, max_tokens) : 4096,
                          ...(top_p ? { top_p } : {}),
                        }),
                      });

                      if (nvRes.ok) {
                        const json = await nvRes.json();
                        const choice = json.choices?.[0]?.message;
                        const text = choice?.content || choice?.reasoning_content || '';
                        if (text) {
                          finalContent = text;
                          finalProvider = 'nvidia';
                          finalModel = mId;
                          break;
                        }
                      }
                      lastStatus = nvRes.status;
                      const errJson = await nvRes.json().catch(() => ({}));
                      lastErrMsg = errJson?.error?.message || errJson?.detail || `NVIDIA status ${lastStatus}`;
                    } catch (e: any) {
                      lastErrMsg = e?.message || 'NVIDIA connection error';
                    }
                  }
                  if (finalContent) break;
                } else if (currentProvider === 'gemini' && geminiKey) {
                  let candidates = [...GEMINI_MODELS];
                  if (model && model.startsWith('gemini-')) {
                    candidates = Array.from(new Set([model, ...candidates]));
                  }

                  const systemParts: Array<{ text: string }> = [];
                  const contents: Array<{ role: 'user' | 'model'; parts: Array<any> }> = [];

                  for (const m of messages) {
                    if (m.role === 'system') {
                      systemParts.push({ text: m.content || '' });
                    } else {
                      const role: 'user' | 'model' = m.role === 'assistant' ? 'model' : 'user';
                      const part: any = { text: m.content || '' };
                      if (contents.length > 0 && contents[contents.length - 1].role === role) {
                        contents[contents.length - 1].parts.push(part);
                      } else {
                        contents.push({ role, parts: [part] });
                      }
                    }
                  }

                  if (contents.length === 0) {
                    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
                  }

                  if (image && image.base64Data) {
                    const lastUser = [...contents].reverse().find((c) => c.role === 'user');
                    const imagePart = {
                      inlineData: {
                        mimeType: image.mimeType || 'image/jpeg',
                        data: image.base64Data,
                      },
                    };
                    if (lastUser) {
                      lastUser.parts.push(imagePart);
                    } else {
                      contents.push({ role: 'user', parts: [imagePart] });
                    }
                  }

                  const chosenMimeType = responseMimeType || response_mime_type;
                  const baseRequestBody: any = {
                    contents,
                    generationConfig: {
                      temperature: typeof temperature === 'number' ? temperature : 0.2,
                      maxOutputTokens: typeof max_tokens === 'number' ? Math.min(8192, Math.max(512, max_tokens)) : 4096,
                      ...(chosenMimeType ? { responseMimeType: chosenMimeType } : {}),
                      topP: top_p,
                    },
                  };

                  if (systemParts.length > 0) {
                    baseRequestBody.system_instruction = { parts: systemParts };
                  }

                  for (const mId of candidates) {
                    try {
                      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${mId}:generateContent?key=${geminiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(baseRequestBody),
                      });

                      if (gRes.ok) {
                        const json = await gRes.json();
                        const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        if (text) {
                          finalContent = text;
                          finalProvider = 'gemini';
                          finalModel = mId;
                          break;
                        }
                      }
                      lastStatus = gRes.status;
                      const errJson = await gRes.json().catch(() => ({}));
                      lastErrMsg = errJson?.error?.message || `Gemini status ${lastStatus}`;
                    } catch (e: any) {
                      lastErrMsg = e?.message || 'Gemini connection error';
                    }
                  }
                  if (finalContent) break;
                } else if (currentProvider === 'nebius' && nebiusKey) {
                  const formattedMessages = messages.map((m: any) => ({
                    role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
                    content: m.content || '',
                  }));

                  for (const mId of NEBIUS_MODELS) {
                    try {
                      const nebRes = await fetch('https://api.studio.nebius.ai/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          Authorization: `Bearer ${nebiusKey}`,
                        },
                        body: JSON.stringify({
                          model: mId,
                          messages: formattedMessages,
                          temperature: typeof temperature === 'number' ? temperature : 0.2,
                          max_tokens: typeof max_tokens === 'number' ? Math.min(4096, max_tokens) : 4096,
                          ...(top_p ? { top_p } : {}),
                        }),
                      });

                      if (nebRes.ok) {
                        const json = await nebRes.json();
                        const text = json.choices?.[0]?.message?.content || '';
                        if (text) {
                          finalContent = text;
                          finalProvider = 'nebius';
                          finalModel = mId;
                          break;
                        }
                      }
                      lastStatus = nebRes.status;
                      const errJson = await nebRes.json().catch(() => ({}));
                      lastErrMsg = errJson?.error?.message || `Nebius status ${lastStatus}`;
                    } catch (e: any) {
                      lastErrMsg = e?.message || 'Nebius connection error';
                    }
                  }
                  if (finalContent) break;
                }
              }

              if (!finalContent) {
                res.statusCode = lastStatus || 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ content: '', error: lastErrMsg || 'All AI providers exhausted' }));
                return;
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                content: finalContent,
                provider: finalProvider,
                model: finalModel,
                task: normalizedTask,
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Local AI orchestrator error' }));
            }
          });
        } else if (req.url?.startsWith('/api/link-preview')) {
          try {
            const urlObj = new URL(req.url, 'http://localhost');
            const targetUrl = urlObj.searchParams.get('url');
            if (!targetUrl) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing url parameter' }));
              return;
            }

            const parsedTarget = new URL(targetUrl);
            const hostname = parsedTarget.hostname.replace(/^www\./, '');
            const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
            const youtubeId = ytMatch ? ytMatch[1] : undefined;

            if (youtubeId) {
              try {
                const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
                if (oembedRes.ok) {
                  const oembed = await oembedRes.json();
                  res.statusCode = 200;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({
                    url: targetUrl,
                    title: oembed.title || 'YouTube Video',
                    description: oembed.author_name
                      ? `Watch on YouTube • Channel: ${oembed.author_name}`
                      : 'Enjoy the videos and music you love, upload original content, and share it all with friends, family, and the world on YouTube.',
                    image: `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`,
                    siteName: oembed.provider_name || 'YouTube',
                    hostname,
                    favicon: 'https://www.youtube.com/s/desktop/f7129524/img/favicon.ico',
                    youtubeId,
                    mediaType: 'video',
                  }));
                  return;
                }
              } catch {}
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4500);

            const fetchRes = await fetch(targetUrl, {
              signal: controller.signal,
              headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/*,*/*;q=0.8',
              },
              redirect: 'follow',
            });
            clearTimeout(timeoutId);

            const contentType = fetchRes.headers.get('content-type') || '';
            const favicon = `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;

            if (contentType.startsWith('image/')) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                url: targetUrl,
                title: parsedTarget.pathname.split('/').pop() || 'Image Preview',
                description: `Image on ${hostname}`,
                image: targetUrl,
                siteName: hostname,
                hostname,
                favicon,
                mediaType: 'image',
              }));
              return;
            }

            const html = (await fetchRes.text()).slice(0, 250000);
            const getMeta = (prop: string): string | null => {
              const r1 = new RegExp(`<meta[^>]*(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, 'i');
              const r2 = new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
              const m = html.match(r1) || html.match(r2);
              return m ? m[1].trim() : null;
            };

            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
            const rawTitle = getMeta('og:title') || getMeta('twitter:title') || (titleMatch ? titleMatch[1].trim() : '') || hostname;
            const rawDesc = getMeta('og:description') || getMeta('twitter:description') || getMeta('description') || '';
            let rawImage = getMeta('og:image') || getMeta('twitter:image') || '';

            if (youtubeId && (!rawImage || rawImage.includes('hqdefault'))) {
              rawImage = `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`;
            }

            if (rawImage && !rawImage.startsWith('http')) {
              try { rawImage = new URL(rawImage, targetUrl).href; } catch {}
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              url: targetUrl,
              title: rawTitle,
              description: rawDesc,
              image: rawImage || undefined,
              siteName: getMeta('og:site_name') || hostname,
              hostname,
              favicon,
              youtubeId,
              mediaType: youtubeId ? 'video' : undefined,
            }));
          } catch {
            const parsedTarget = new URL(req.url, 'http://localhost');
            const targetUrl = parsedTarget.searchParams.get('url') || '';
            let hostname = '';
            try { hostname = new URL(targetUrl).hostname.replace(/^www\./, ''); } catch {}
            const ytMatch = targetUrl.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/);
            const youtubeId = ytMatch ? ytMatch[1] : undefined;

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              url: targetUrl,
              title: hostname || targetUrl,
              description: targetUrl,
              image: youtubeId ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg` : undefined,
              hostname: hostname || 'link',
              siteName: hostname || 'link',
              favicon: hostname ? `https://www.google.com/s2/favicons?domain=${hostname}&sz=64` : undefined,
              youtubeId,
              mediaType: youtubeId ? 'video' : undefined,
            }));
          }
        } else if (req.url === '/api/send-push' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const parsed = JSON.parse(body || '{}');
              const { recipientId, senderId, senderName, bodySnippet } = parsed;

              const SUPABASE_PROJECT_ID = env.SUPABASE_PROJECT_ID || 'ogukrtsucsnxvrudvobv';
              const SUPABASE_URL = env.SUPABASE_URL || `https://${SUPABASE_PROJECT_ID}.supabase.co`;
              const SUPABASE_KEY =
                env.SUPABASE_SERVICE_ROLE_KEY ||
                env.SUPABASE_ANON_KEY ||
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ndWtydHN1Y3NueHZydWR2b2J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MDQ2MTksImV4cCI6MjEwMTE4MDYxOX0.cI7kzHbsSOYbiO3izp-sXhDinBMTCV5vmQXcllAfqy0';

              const VAPID_PUBLIC_KEY =
                env.VAPID_PUBLIC_KEY ||
                env.VITE_VAPID_PUBLIC_KEY ||
                'BMKEHNDgWBUAaPiWvn753OXxngSbuIFN2obnsGzYl4MeHDIDbFoPnf-NdpSMnA6VUfnRwR-8clEfK4RyRLPAleE';

              const VAPID_PRIVATE_KEY =
                env.VAPID_PRIVATE_KEY ||
                '9pXFfA-hfNMemTlefmPci2uKaRsWDT53knGkvO-ajQs';

              const VAPID_SUBJECT = env.VAPID_SUBJECT || 'mailto:support@dreamit.app';

              try {
                webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
              } catch {}

              const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
              const { data: subscriptions } = await supabaseClient
                .from('push_subscriptions')
                .select('*')
                .eq('user_id', recipientId);

              if (!subscriptions || subscriptions.length === 0) {
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: true, sentCount: 0, message: 'No subscriptions found' }));
                return;
              }

              const payload = JSON.stringify({
                title: `${senderName || 'Friend'} • Dream It`,
                body: bodySnippet || 'Sent you a message',
                icon: '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag: `dreamit-dm-${senderId}`,
                friendId: senderId,
                url: `/?openChat=${encodeURIComponent(senderId)}`,
              });

              let sentCount = 0;
              const expiredEndpoints: string[] = [];

              await Promise.all(
                subscriptions.map(async (sub: any) => {
                  try {
                    await webpush.sendNotification(
                      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                      payload,
                      { TTL: 60 * 60 * 24, urgency: 'high' }
                    );
                    sentCount++;
                  } catch (err: any) {
                    if (err?.statusCode === 410 || err?.statusCode === 404) {
                      expiredEndpoints.push(sub.endpoint);
                    }
                  }
                })
              );

              if (expiredEndpoints.length > 0) {
                await supabaseClient.from('push_subscriptions').delete().in('endpoint', expiredEndpoints).catch(() => {});
              }

              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: true, sentCount, total: subscriptions.length }));
            } catch (pushErr: any) {
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ success: false, error: pushErr?.message || 'Push dispatch failed' }));
            }
          });
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      figmaAssetResolver(),
      localAiProxyPlugin(env),
      // The React and Tailwind plugins are both required for Make, even if
      // Tailwind is not being actively used – do not remove them
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: {
        // Alias @ to the src directory
        '@': path.resolve(__dirname, './src'),
      },
    },

    // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
    assetsInclude: ['**/*.svg', '**/*.csv'],
    build: {
      target: 'esnext',
      minify: 'esbuild',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router'],
            'ui-vendor': ['lucide-react'],
            'animation-vendor': ['motion'],
            'chart-vendor': ['recharts'],
            'supabase-vendor': ['@supabase/supabase-js'],
            'clerk-vendor': ['@clerk/clerk-react'],
            'markdown-vendor': ['react-markdown', 'remark-gfm'],
            'katex-vendor': ['katex', 'rehype-katex', 'remark-math'],
            'pdf-vendor': ['pdfjs-dist'],
            'sentry-vendor': ['@sentry/react'],
          }
        }
      }
    }
  };
});
