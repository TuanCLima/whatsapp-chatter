"use strict";
/* import dotenv from "dotenv";
dotenv.config();

const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/query";
const API_KEY = process.env.LLM_API_KEY;

interface QueryRequest {
  prompt: string;
}

interface QueryResponse {
  text: string;
}

import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://api.deepseek.com", // DeepSeek's API base URL
  apiKey: API_KEY, // Replace with your actual API key
});

export async function queryDeepSeek(prompt: string) {
  try {
    const completion = await openai.chat.completions.create({
      model: "deepseek-chat", // Specify the model
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "What is the capital of France?" },
      ],
    });

    console.log("DeepSeek Response:", completion.choices[0].message.content);
    return completion.choices[0].message.content;
  } catch (error) {
    console.error("Error calling DeepSeek API:", error);
  }
}
 */
