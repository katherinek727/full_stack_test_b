// filename: groqTest.js
require('dotenv').config();
const axios = require('axios');

const API_KEY = process.env.GROQ_API_KEY;
const BASE_URL = 'https://api.groq.com/v1'; // Groq API base URL

async function listModels() {
  try {
    const res = await axios.get(`${BASE_URL}/models`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    console.log("Available models:");
    res.data.models.forEach(model => {
      console.log(`- ${model.name}: ${model.description || "No description"}`);
    });
    return res.data.models;
  } catch (err) {
    console.error("Error listing models:", err.response?.data || err.message);
    return [];
  }
}

async function runInference(modelName, text) {
  try {
    const res = await axios.post(`${BASE_URL}/inference`, 
      {
        model: modelName,
        input_text: text
      },
      {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
      }
    );
    console.log(`\nResponse from model ${modelName}:`);
    console.log(res.data);
  } catch (err) {
    console.error("Error running inference:", err.response?.data || err.message);
  }
}

(async () => {
  const models = await listModels();
  if (models.length > 0) {
    // Use the first available model
    await runInference(models[0].name, "Hello, what is the capital of France?");
  } else {
    console.log("No accessible models found for your API key.");
  }
})();