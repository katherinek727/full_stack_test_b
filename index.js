const express = require("express");
const cors = require("cors");
const OpenAI = require("openai").default;
const { HttpsProxyAgent } = require("https-proxy-agent");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// OpenAI client with optional proxy
function createOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  const proxyUrl = process.env.PROXY_URL; // e.g. http://username:password@your-proxy-server:port

  const options = {
    apiKey,
  };

  if (proxyUrl) {
    const agent = new HttpsProxyAgent(proxyUrl);
    options.httpAgent = agent;
    options.httpsAgent = agent;
  }

  return new OpenAI(options);
}

// Test route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// Sleep helper for retry backoff
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ChatGPT route with retry on rate limit (429)
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).json({ error: "Message is required" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    return res.status(503).json({
      error: "OpenAI API key is not configured. Add OPENAI_API_KEY to the server .env file.",
    });
  }

  const maxRetries = 3;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const openai = createOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
        max_tokens: 1024,
      });

      const reply = completion.choices[0]?.message?.content;
      if (!reply) {
        return res.status(502).json({ error: "Empty response from ChatGPT" });
      }
      return res.json({ reply });
    } catch (error) {
      lastError = error;
      const status = error.status ?? error.response?.status;

      if (status === 429 && attempt < maxRetries) {
        const retryAfter = error.response?.headers?.["retry-after"];
        const waitMs = retryAfter ? Math.min(Number(retryAfter) * 1000, 30000) : Math.pow(2, attempt) * 1000;
        console.warn(`OpenAI rate limit (429), retrying in ${waitMs / 1000}s (attempt ${attempt}/${maxRetries})`);
        await sleep(waitMs);
        continue;
      }

      break;
    }
  }

  const error = lastError;
  const status = error?.status ?? error?.response?.status;
  const data = error?.error ?? error?.response?.data;

  let errorMessage = "Failed to get response from ChatGPT";
  if (status === 401) {
    errorMessage = "Invalid OpenAI API key. Check OPENAI_API_KEY in .env";
  } else if (status === 429) {
    errorMessage =
      "Rate limit or quota exceeded. Wait a minute and try again, or check usage and billing at platform.openai.com.";
  } else if (data?.message) {
    errorMessage = data.message;
  } else if (error?.code === "ECONNREFUSED" || error?.code === "ENOTFOUND") {
    errorMessage = "Cannot reach OpenAI. Check your internet connection or proxy settings.";
  } else if (error?.message) {
    errorMessage = error.message;
  }

  console.error("OpenAI error:", status, data || error?.message);
  res.status(status && status >= 400 && status < 600 ? status : 500).json({ error: errorMessage });
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));