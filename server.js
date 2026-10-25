import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { buildAdvisorPrompt } from "./src/lib/prompt.ts";
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
async function startServer() {
  const app = express();
  const isProduction = process.env.NODE_ENV === "production";
  const PORT = process.env.DEFAULT_APP_PORT ? parseInt(process.env.DEFAULT_APP_PORT, 10) : 3e3;
  app.use(express.json({ limit: "30mb" }));
  app.get(["/api/health", "/api/health/"], (req, res) => {
    res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
  });
  app.post(["/api/analyze", "/api/analyze/"], async (req, res) => {
    try {
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      if (!apiKey) {
        return res.status(500).json({
          error: "Gemini API \uD0A4\uAC00 \uC11C\uBC84 \uD658\uACBD \uBCC0\uC218\uC5D0 \uC124\uC815\uB418\uC9C0 \uC54A\uC558\uC2B5\uB2C8\uB2E4. AI Studio Secrets \uB610\uB294 \uD658\uACBD \uBCC0\uC218(GEMINI_API_KEY)\uB97C \uD655\uC778\uD574\uC8FC\uC138\uC694."
        });
      }
      const { manualInput = "", fileData = null } = req.body;
      if (!fileData && !manualInput.trim()) {
        return res.status(400).json({ error: "\uBD84\uC11D\uD560 \uD30C\uC77C\uC774\uB098 \uC99D\uC0C1\uC744 \uC785\uB825\uD574\uC8FC\uC138\uC694." });
      }
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
      const prompt = buildAdvisorPrompt(manualInput);
      const parts = [{ text: prompt }];
      if (fileData && fileData.data && fileData.mimeType) {
        parts.push({
          inlineData: {
            mimeType: fileData.mimeType,
            data: fileData.data
          }
        });
      }
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: parts,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW
          }
        }
      });
      if (!response.text) {
        throw new Error("\uBD84\uC11D \uACB0\uACFC\uB97C \uC0DD\uC131\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.");
      }
      return res.json({ result: response.text });
    } catch (error) {
      console.error("Server Analyze Error:", error);
      return res.status(500).json({
        error: error?.message || "\uBD84\uC11D \uC911 \uC11C\uBC84 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694."
      });
    }
  });
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true }
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`CellHealth AI server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
