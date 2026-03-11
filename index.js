const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("Server is running");
});

// ChatGPT route
app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) return res.status(400).json({ error: "Message is required" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === "your_openai_api_key_here") {
    return res.status(503).json({
      error: "OpenAI API key is not configured. Add OPENAI_API_KEY to the server .env file.",
    });
  }

  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: message }],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        timeout: 60000,
      }
    );

    const reply = response.data.choices[0]?.message?.content;
    if (!reply) {
      return res.status(502).json({ error: "Empty response from ChatGPT" });
    }
    res.json({ reply });
  } catch (error) {
    const status = error.response?.status;
    const data = error.response?.data;

    let message = "Failed to get response from ChatGPT";
    if (status === 401) {
      message = "Invalid OpenAI API key. Check OPENAI_API_KEY in .env";
    } else if (status === 429) {
      message = "Rate limit or quota exceeded. Try again later or check your OpenAI account.";
    } else if (data?.error?.message) {
      message = data.error.message;
    } else if (error.code === "ECONNREFUSED" || error.code === "ENOTFOUND") {
      message = "Cannot reach OpenAI. Check your internet connection.";
    } else if (error.message) {
      message = error.message;
    }

    console.error("OpenAI error:", status, data?.error || error.message);
    res.status(status && status >= 400 && status < 600 ? status : 500).json({ error: message });
  }
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));