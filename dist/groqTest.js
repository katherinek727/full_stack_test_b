"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const axios_1 = __importDefault(require("axios"));
dotenv_1.default.config();
const API_KEY = process.env.GROQ_API_KEY;
const BASE_URL = "https://api.groq.com/v1";
async function listModels() {
    try {
        const res = await axios_1.default.get(`${BASE_URL}/models`, {
            headers: { Authorization: `Bearer ${API_KEY}` },
        });
        console.log("Available models:");
        res.data.models.forEach((model) => {
            console.log(`- ${model.name}: ${model.description || "No description"}`);
        });
        return res.data.models;
    }
    catch (err) {
        console.error("Error listing models:", err.response?.data || err.message);
        return [];
    }
}
async function runInference(modelName, text) {
    try {
        const res = await axios_1.default.post(`${BASE_URL}/inference`, {
            model: modelName,
            input_text: text,
        }, {
            headers: { Authorization: `Bearer ${API_KEY}` },
        });
        console.log(`\nResponse from model ${modelName}:`);
        console.log(res.data);
    }
    catch (err) {
        console.error("Error running inference:", err.response?.data || err.message);
    }
}
async function main() {
    const models = await listModels();
    if (models.length > 0) {
        await runInference(models[0].name, "Hello, what is the capital of France?");
    }
    else {
        console.log("No accessible models found for your API key.");
    }
}
void main();
//# sourceMappingURL=groqTest.js.map