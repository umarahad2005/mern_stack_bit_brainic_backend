import { GoogleGenAI } from '@google/genai';

// BitBraniac System Prompt
const SYSTEM_PROMPT = `
You are "BitBraniac" 🧠, an expert AI tutor designed to help users learn **Computer Science** in an interactive and engaging way.
Your goal is to provide **clear explanations, real-world examples, and helpful coding snippets** to teach CS concepts effectively.

# PERSONALITY TRAITS:
- Friendly, slightly nerdy 🤓, and highly knowledgeable
- Uses simple explanations first, then deeper insights if requested
- Occasionally throws in **light humor or geeky references** (but stays professional)
- Includes relevant emojis in responses to keep conversations fun 🎯
- Encourages users to **ask follow-up questions** and explore topics further

# RESPONSE FORMAT:
- Match the user's preferred language (English only for now)
- Use **Markdown formatting** for readability:
  - Use **bold** for emphasis
  - Use _italics_ for subtle emphasis
  - Use bullet points for listing concepts
  - Use numbered lists for step-by-step explanations
- Include **code snippets** in a well-formatted manner when needed
- Keep responses interactive and engaging

# CONVERSATION APPROACH:
- Greet users with a **fun, CS-related opening line** (e.g., "Hello, World! Ready to code?")
- Ask follow-up questions to **assess their level of understanding**
- Offer **real-world analogies** for complex topics
- Suggest coding exercises or quizzes when appropriate
- Keep conversations **engaging and informative**

# DOMAIN RESTRICTIONS:
- ONLY answer **Computer Science-related** topics, including:
  ✅ Programming (Java, Python, C++, etc.)
  ✅ Data Structures & Algorithms
  ✅ Databases (SQL, NoSQL)
  ✅ Operating Systems & Networking
  ✅ Artificial Intelligence & Machine Learning Basics
  ✅ Software Engineering & Best Practices
- If asked about **non-CS topics** (politics, sports, general knowledge, etc.), politely redirect:
  _"I'm all about Computer Science! Want to learn about algorithms instead?"_
- If the question is **too broad or unclear**, ask for clarification before answering.

# TEACHING STYLE:
- Uses **step-by-step explanations** 🏗️
- Encourages hands-on practice 💻
- Explains with **real-world examples** 🌍
- Uses humor and references when appropriate (e.g., _"Think of recursion like a mirror reflecting itself endlessly!"_)

# EXTRA FEATURES:
- Can **generate simple coding problems** 💡
- Provides **debugging guidance** when users share code
- Suggests **career advice for different CS fields**
- Stays **patient and adaptive** to different learning speeds

Never forget that your name is **BitBraniac** 🧠, and you must maintain this identity throughout the conversation.
Always keep your responses **educational, engaging, and fun** while staying strictly within the **Computer Science domain**.
`;

/**
 * Build personalized system prompt with user's persona and interests
 * @param {Object} user - User object with persona and interests
 * @returns {string} - Personalized system prompt
 */
const buildPersonalizedPrompt = (user) => {
    let prompt = SYSTEM_PROMPT;

    if (user?.interests?.length > 0) {
        prompt += `\n\n# USER'S INTERESTS:\nThis user is particularly interested in: ${user.interests.join(', ')}. ` +
            `When relevant, prioritize examples and explanations related to these topics.`;
    }

    if (user?.persona?.trim()) {
        prompt += `\n\n# USER'S CUSTOM INSTRUCTIONS:\n${user.persona}`;
    }

    return prompt;
};

// Maximum messages to keep in history (30 messages = 15 exchanges)
const MAX_HISTORY_MESSAGES = 30;

// Lazy initialization of the AI client
let _ai = null;

const getAI = () => {
    if (!_ai) {
        if (!process.env.GEMINI_API_KEY) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return _ai;
};

/**
 * Trim chat history to keep only the last N messages
 * @param {Array} messages - Array of message objects
 * @returns {Array} - Trimmed array of messages
 */
const trimChatHistory = (messages) => {
    if (messages.length <= MAX_HISTORY_MESSAGES) {
        return messages;
    }
    // Keep the most recent messages
    return messages.slice(-MAX_HISTORY_MESSAGES);
};

/**
 * Convert database messages to Gemini chat format
 * @param {Array} messages - Array of messages from database
 * @returns {Array} - Array of Gemini message objects
 */
const convertToGeminiHistory = (messages) => {
    return messages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
    }));
};

/**
 * Generate AI response using Google Generative AI (new SDK)
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} user - User object with persona and interests (optional)
 * @param {number} retryCount - Current retry attempt
 * @returns {Promise<string>} - AI generated response
 */
const generateResponse = async (messages, user = null, retryCount = 0) => {
    const MAX_RETRIES = 3;
    const MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash']; // Fallback models

    try {
        const ai = getAI();

        // Trim history to last 30 messages
        const trimmedMessages = trimChatHistory(messages);

        if (trimmedMessages.length === 0) {
            throw new Error('No messages to process');
        }

        // Get the last user message
        const lastMessage = trimmedMessages[trimmedMessages.length - 1];

        if (lastMessage.role !== 'user') {
            throw new Error('Last message must be from user');
        }

        // Convert all messages to Gemini history format, excluding the last one
        const history = convertToGeminiHistory(trimmedMessages.slice(0, -1));

        // Select model based on retry count
        const modelIndex = Math.min(Math.floor(retryCount / 2), MODELS.length - 1);
        const selectedModel = MODELS[modelIndex];

        console.log(`Sending message to Gemini (${selectedModel}) with`, history.length, 'messages in history');

        // Build personalized system prompt
        const personalizedPrompt = buildPersonalizedPrompt(user);

        // Create a chat session with history using new SDK
        const chat = ai.chats.create({
            model: selectedModel,
            history: history,
            config: {
                systemInstruction: personalizedPrompt,
                maxOutputTokens: 8192,
                temperature: 0.8,
            },
        });

        // Send the last user message
        const response = await chat.sendMessage({
            message: lastMessage.content
        });

        return response.text;
    } catch (error) {
        console.error('Gemini API Error:', error.message);

        // Check for retryable errors (503, 429, overloaded)
        const errorStatus = error.status || error.statusCode;
        const errorMessage = typeof error.message === 'string' ? error.message : JSON.stringify(error.message);

        const isRetryable = errorStatus === 503 || errorStatus === 429 ||
            errorMessage?.includes('503') ||
            errorMessage?.includes('429') ||
            errorMessage?.includes('overloaded') ||
            errorMessage?.includes('UNAVAILABLE') ||
            errorMessage?.includes('rate limit');

        if (isRetryable && retryCount < MAX_RETRIES) {
            const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
            console.log(`Model overloaded, retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return generateResponse(messages, user, retryCount + 1);
        }

        // Provide more specific error messages
        if (error.message?.includes('API key') || error.message?.includes('API_KEY')) {
            throw new Error('Invalid or missing Gemini API key. Please check your configuration.');
        } else if (error.message?.includes('quota')) {
            throw new Error('API quota exceeded. Please try again later.');
        } else if (error.message?.includes('safety') || error.message?.includes('SAFETY')) {
            throw new Error('Response blocked due to safety settings. Please rephrase your question.');
        } else if (error.message?.includes('not found') || error.message?.includes('404')) {
            throw new Error('Model not found. Please check the model name configuration.');
        } else if (error.status === 503 || error.message?.includes('overloaded')) {
            throw new Error('AI service is currently busy. Please try again in a moment.');
        }

        throw new Error(`Failed to generate response: ${error.message}`);
    }
};

export { generateResponse, trimChatHistory, MAX_HISTORY_MESSAGES };
