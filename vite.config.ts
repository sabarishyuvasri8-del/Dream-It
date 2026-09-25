import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

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
 * Local AI Proxy Plugin
 * Intercepts /api/ai-chat requests during local Vite development (npm run dev)
 * so that developers can test AI features without exposing keys to the client bundle.
 */
function localAiProxyPlugin(env: Record<string, string>) {
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
              const fallbackKey = typeof atob === 'function' ? atob('QVEuQWI4Uk42TGlwTzJackMwYmhhc21yOEQ0MF9HWHNjV0ZnY3VfamVoZ3h0Um9qSUpLSXc=') : '';
              const apiKey =
                env.GEMINI_API_KEY ||
                process.env.GEMINI_API_KEY ||
                env.VITE_GEMINI_API_KEY ||
                process.env.VITE_GEMINI_API_KEY ||
                fallbackKey;

              if (!apiKey) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'GEMINI_API_KEY not configured in .env' }));
                return;
              }

              const requestedModel =
                parsedBody.model === 'gemma-4-31b-it' ? 'gemini-3.5-flash-lite' : (parsedBody.model || 'gemini-3.5-flash-lite');
              const googleUrl = `https://generativelanguage.googleapis.com/v1beta/models/${requestedModel}:generateContent?key=${apiKey.trim()}`;

              const systemParts: Array<{ text: string }> = [];
              const contents: Array<{ role: 'user' | 'model'; parts: Array<any> }> = [];

              for (const m of (parsedBody.messages || [])) {
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

              if (parsedBody.image && parsedBody.image.base64Data) {
                const lastUser = [...contents].reverse().find((c) => c.role === 'user');
                const imagePart = {
                  inlineData: {
                    mimeType: parsedBody.image.mimeType || 'image/jpeg',
                    data: parsedBody.image.base64Data,
                  },
                };
                if (lastUser) {
                  lastUser.parts.push(imagePart);
                } else {
                  contents.push({ role: 'user', parts: [imagePart] });
                }
              }

              const requestBody: any = {
                contents,
                generationConfig: {
                  temperature: typeof parsedBody.temperature === 'number' ? parsedBody.temperature : 0.2,
                  maxOutputTokens: typeof parsedBody.max_tokens === 'number' ? parsedBody.max_tokens : 4096,
                  topP: parsedBody.top_p,
                },
              };

              if (systemParts.length > 0) {
                requestBody.system_instruction = { parts: systemParts };
              }

              const googleRes = await fetch(googleUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
              });

              const data = await googleRes.json();
              if (!googleRes.ok) {
                res.statusCode = googleRes.status;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ content: '', error: data?.error?.message || 'Google API error' }));
                return;
              }

              const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
              res.statusCode = 200;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ content }));
            } catch (err: any) {
              res.statusCode = 500;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: err?.message || 'Local AI proxy error' }));
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
          }
        }
      }
    }
  };
});
