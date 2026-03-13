const express = require("express");
const cors = require("cors");
const OpenAI = require("openai").default;
const { ProxyAgent } = require("undici");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Optional proxy for outbound HTTP (used by OpenAI client)
const proxyUrl = process.env.PROXY_URL; // e.g. http://user:pass@host:port
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : null;

// Create an OpenAI client configured to talk to Groq's OpenAI-compatible API
function createGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
    fetch: (url, options) => {
      if (!proxyAgent) return fetch(url, options);

      return fetch(url, {
        ...options,
        dispatcher: proxyAgent,
      });
    },
  });
}

// Health check route
app.get("/", (_req, res) => {
  res.send("Server is running");
});

// Chat route – forwards the user message to Groq and returns the reply
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

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
    const response = await client.responses.create({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      input: message,
    });

    const reply =
      response.output_text ||
      response.output?.[0]?.content?.[0]?.text ||
      null;

    if (!reply) {
      return res
        .status(502)
        .json({ error: "Empty response from Groq (via OpenAI client)" });
    }

    return res.json({ reply });
  } catch (error) {
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

    return res.status(status).json({ error: messageText });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});