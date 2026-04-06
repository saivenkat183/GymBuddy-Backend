const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config({ path: './.env' });

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/workouts', require('./routes/workouts'));
app.use('/api/users', require('./routes/users'));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'GymBuddy Backend is running!' });
});

// AI Trainer route
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history, context } = req.body;
    const configuredModels = (process.env.GEMINI_MODELS || process.env.GEMINI_MODEL || 'gemini-2.5-flash,gemini-2.0-flash,gemini-flash-latest')
      .split(',')
      .map(m => m.trim())
      .filter(Boolean);

    const systemPrompt = `You are GymBuddy AI, a precise and sharp fitness coach inside the GymBuddy app.
${context}
Follow these rules strictly:
- Give direct, practical answers with no filler.
- Keep replies short, clear, and action-focused.
- Use bullet points or numbered steps when useful.
- Focus on workouts, nutrition, recovery, fat loss, muscle gain, and exercise form.
- When giving workout advice, include sets, reps, rest time, and key form cues when relevant.
- If the user's request is vague, ask one short clarifying question.
- Do not over-explain, repeat the question, or add unnecessary intro text.
- Keep the tone confident, motivating, and professional.`;

    const chatHistory = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: 'Understood. I will give short, precise, and actionable fitness guidance for GymBuddy users.' }]
      },
      ...(Array.isArray(history) ? history : []).map(h => ({
        role: h.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: h.content }]
      }))
    ];

    let lastError;
    let preferredError;
    for (const modelName of configuredModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const chat = model.startChat({ history: chatHistory });
        const result = await chat.sendMessage(message);
        const reply = result.response.text();
        return res.json({ reply, modelUsed: modelName });
      } catch (modelErr) {
        lastError = modelErr;
        if (!String(modelErr.message || '').includes('404 Not Found') && !preferredError) {
          preferredError = modelErr;
        }
        console.warn(`Model ${modelName} failed:`, modelErr.message);
      }
    }

    if (!preferredError && lastError && String(lastError.message || '').includes('404 Not Found')) {
      throw new Error('No supported Gemini model is configured. Set GEMINI_MODEL to gemini-2.5-flash in Render and redeploy.');
    }

    throw preferredError || lastError || new Error('No valid Gemini model available.');
  } catch (err) {
    console.error('AI error:', err);
    res.status(500).json({ message: 'AI error', error: err.message });
  }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB!');
    app.listen(process.env.PORT, () => {
      console.log(`✅ Server running on port ${process.env.PORT}`);
    });
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));