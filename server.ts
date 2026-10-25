import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildAdvisorPrompt } from './src/lib/prompt.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  // Dev server and container must run on port 3000 behind AI Studio proxy
  const PORT = process.env.DEFAULT_APP_PORT ? parseInt(process.env.DEFAULT_APP_PORT, 10) : 3000;

  // Support JSON payloads up to 30mb for medical reports / photos
  app.use(express.json({ limit: '30mb' }));

  // Enable CORS for development and cross-origin previews
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Health check endpoint
  app.get(['/api/health', '/api/health/'], (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Server-side Gemini API route
  app.post(['/api/analyze', '/api/analyze/'], async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        return res.status(500).json({
          error: 'Gemini API 키가 서버 환경 변수에 설정되지 않았습니다. AI Studio Secrets 또는 환경 변수(GEMINI_API_KEY)를 확인해주세요.'
        });
      }

      const { manualInput = '', fileData = null } = req.body;

      if (!fileData && !manualInput.trim()) {
        return res.status(400).json({ error: '분석할 파일이나 증상을 입력해주세요.' });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = buildAdvisorPrompt(manualInput);

      const parts: any[] = [{ text: prompt }];
      if (fileData && fileData.data && fileData.mimeType) {
        parts.push({
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.data,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: parts,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
        },
      });

      if (!response.text) {
        throw new Error('분석 결과를 생성하지 못했습니다.');
      }

      return res.json({ result: response.text });
    } catch (error: any) {
      console.error('Server Analyze Error:', error);
      return res.status(500).json({ 
        error: error?.message || '분석 중 서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' 
      });
    }
  });

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CellHealth AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
