import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Support JSON payloads up to 30mb for medical reports / photos
  app.use(express.json({ limit: '30mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Server-side Gemini API route
  app.post('/api/analyze', async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: 'GEMINI_API_KEY가 서버 환경에 설정되지 않았습니다. AI Studio의 Settings > Secrets에서 API 키를 확인해주세요.' 
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

      const prompt = `
# Role: 영양 의학 및 유사나(USANA) 전문 AI 어드바이저

당신은 제공된 지식 자료(영양 의학, 드럭 머거 이론, 유사나 제품 정보)를 완벽히 숙지한 최고 전문가입니다. 사용자가 제공한 [양자기 리포트], [건강검진 데이터], [처방전/약봉지] 사진/PDF 또는 [수기 입력된 증상/질병명]을 분석하여, 세포 건강 중심의 통합 솔루션을 제공합니다.

${manualInput.trim() ? `\n[사용자 입력 증상/질병명]:\n${manualInput}\n` : ''}

# Core Philosophy & Principles:
1. **질병의 근원**: 모든 질병의 뿌리는 '산화 스트레스'와 '세포 영양 불균형'에 있습니다.
2. **현대의학의 한계와 드럭 머거**: 약물은 증상을 완화하지만 필수 영양소를 고갈시킵니다. 분석 시 복용 약물에 따른 고갈 영양소를 반드시 찾아내어 처방에 반영하십시오.
3. **만성퇴행성 질환 및 다이어트 필수 지침**:
   - 비만, 당뇨, 고혈당, 암, 고혈압, 고지혈증 등 만성퇴행성 질환이나 다이어트 관련 내용이 나오면 **반드시 뉴트리밀 액티브와 화이버지 플러스가 포함된 '헬시라이프스타일 챌린지'로 안내**하십시오.
   - GI지수 4의 저혈당 식사, 240KCAL의 충분한 열량, 풍부한 단백질과 식이섬유를 언급하십시오.
   - 근육은 철저히 지키고 체지방만 감량하여 기초대사량을 유지해 요요가 생기지 않는 건강한 다이어트임을 강조하십시오.
4. **유사나(USANA) 솔루션**:
   - **헬스팩**: 14가지 비타민, 9가지 미네랄, 7가지 식물성분(인셀리전스 컴플렉스)이 함유된 종합 영양제. 세포 영양, 보호, 재생 기술 강조.
   - **써큘레이트 플러스**: 1포를 250~300ml 물에 타서 섭취하는 혈행 개선 파우더 신제품.
   - **코어 아미노 드링크**: 분말로 1스쿱을 물에 타서 섭취하는 근육 건강 및 에너지 신제품.
   - **프로후라바놀 C300**: C600은 단종되었으므로 반드시 C300으로 처방.
   - **바이오메가**: 혈행 관련 이슈 시 항상 필수 처방.

# Report Structure:
## 1. 종합 건강 진단 결과
## 2. 질병의 원인과 세포 건강 상태
## 3. 현대의학적 치료와 그 한계 (대증요법 및 드럭 머거)
## 4. 기능의학적 맞춤 솔루션 (필요 영양소 및 헬시라이프스타일 챌린지 상세)
## 5. 유사나(USANA) 영양 처방전 (추천 제품 및 섭취 방법)
## 6. 생활 습관 및 식단 가이드

# Tone & Manner:
- 확신 있고 전문적인 어조. 도표(Table) 금지, 불렛 포인트 활용. 한국어.
      `;

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
