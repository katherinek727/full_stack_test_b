"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const openai_1 = __importDefault(require("openai"));
const undici_1 = require("undici");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
const proxyUrl = process.env.PROXY_URL;
const proxyAgent = proxyUrl ? new undici_1.ProxyAgent(proxyUrl) : null;
function createGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
        return null;
    }
    return new openai_1.default({
        apiKey,
        baseURL: "https://api.groq.com/openai/v1",
        fetch: (url, options) => {
            if (!proxyAgent)
                return fetch(url, options);
            return fetch(url, {
                ...options,
                dispatcher: proxyAgent,
            });
        },
    });
}
app.get("/", (_req, res) => {
    res.send("Server is running");
});
app.post("/api/chat", async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Message is required" });
    }
    const client = createGroqClient();
    if (!client) {
        return res.status(503).json({
            error: "GROQ_API_KEY is not configured. Add it to the server .env file.",
        });
    }
    try {
        const response = await client.responses.create({
            model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
            input: message,
        });
        const reply = response.output_text ||
            response.output?.[0]?.content?.[0]?.text ||
            null;
        if (!reply) {
            return res
                .status(502)
                .json({ error: "Empty response from Groq (via OpenAI client)" });
        }
        return res.json({ reply });
    }
    catch (error) {
        console.error("Groq (via OpenAI client) error:", error?.status, error?.message || error);
        const status = typeof error?.status === "number" &&
            error.status >= 400 &&
            error.status < 600
            ? error.status
            : 500;
        const messageText = error?.message || "Failed to get response from Groq.";
        return res
            .status(status && status >= 400 && status < 600 ? status : 500)
            .json({ error: messageText });
    }
});
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map