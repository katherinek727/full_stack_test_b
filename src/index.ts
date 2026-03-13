import express, { Request, Response } from "express";
import cors from "cors";
import OpenAI from "openai";
import { ProxyAgent } from "undici";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const proxyUrl = process.env.PROXY_URL;
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : null;

function createGroqClient(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
    fetch: (url, options) => {
      if (!proxyAgent) return fetch(url, options as any);

      return fetch(url, {
        ...(options as any),
        dispatcher: proxyAgent,
      } as any);
    },
  });
}

app.get("/", (_req: Request, res: Response) => {
  res.send("Server is running");
});

app.post("/api/chat", async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const client = createGroqClient();
  if (!client) {
    return res.status(503).json({
      error:
        "GROQ_API_KEY is not configured. Add it to the server .env file.",
    });
  }

  try {
    const response: any = await client.responses.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      input: message,
    });

    const reply =
      (response as any).output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      null;

    if (!reply) {
      return res
        .status(502)
        .json({ error: "Empty response from Groq (via OpenAI client)" });
    }

    return res.json({ reply });
  } catch (error: any) {
    console.error(
      "Groq (via OpenAI client) error:",
      error?.status,
      error?.message || error,
    );

    const status =
      typeof error?.status === "number" &&
      error.status >= 400 &&
      error.status < 600
        ? error.status
        : 500;

    const messageText =
      error?.message || "Failed to get response from Groq.";
    return res
      .status(status && status >= 400 && status < 600 ? status : 500)
      .json({ error: messageText });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

