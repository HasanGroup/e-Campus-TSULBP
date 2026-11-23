import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Exposes runtime Maps JS API key if injected without VITE_ prefix in container env
  app.get('/api/maps-config', (_req, res) => {
    const apiKey =
      process.env.VITE_GOOGLE_MAPS_API_KEY ||
      process.env.GOOGLE_MAPS_API_KEY ||
      '';
    res.json({ apiKey });
  });

  app.post('/api/campus-search', async (req, res) => {
    const body = req.body as {
      buildingNameTj?: string;
      buildingNameRu?: string;
      buildingNameEn?: string;
      searchQuery?: string;
    };

    const ai = createGeminiClient();
    if (!ai) {
      res.status(503).json({
        error:
          'GEMINI_API_KEY is not configured in the server environment. Set it in Settings > Secrets to enable live Search grounding.',
      });
      return;
    }

    const queryFocus =
      body.searchQuery ||
      `${body.buildingNameEn || ''} ${body.buildingNameRu || ''} Tajik State University of Law, Business and Politics Khujand`;

    const prompt = `Provide concise, factual, up-to-date information using Google Search about the Tajik State University of Law, Business, and Politics (TSULBP / ДДҲБСТ / ТГУПБП) in Khujand, Tajikistan (17th Microdistrict, House 1, Tashkent Avenue), focusing specifically on: ${queryFocus}.

Include:
1. Verified academic role, faculties, or campus context for this facility/area.
2. Any notable recent university news, academic programs, or campus details found in search results.
Keep the response clear, accurate, and concise (3-5 sentences or short bullets in English with official Tajik/Russian terms where helpful). Do not invent unverified facts.`;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const summary =
        response.text?.trim() ||
        'No live search summary was returned for this campus building.';

      const rawChunks =
        response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];

      const seen = new Set<string>();
      const sources: Array<{ title: string; uri: string }> = [];
      for (const chunk of rawChunks) {
        const uri = chunk?.web?.uri;
        const title = chunk?.web?.title;
        if (uri && !seen.has(uri)) {
          seen.add(uri);
          sources.push({
            title: title || uri,
            uri,
          });
        }
      }

      res.json({ summary, sources });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to query Gemini Search grounding.';
      res.status(502).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`TSULBP 3D Digital Twin server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
