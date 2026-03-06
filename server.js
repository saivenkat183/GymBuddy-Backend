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

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'GymBuddy Backend is running!' });
});

// AI Trainer route
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, history, context } = req.body;
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const systemPrompt = `You are an expert AI personal trainer and nutritionist inside a gym tracking app called GymBuddy.
${context}
Give helpful, motivating, and concise fitness advice.
Include diet, workout, and recovery tips when relevant.
Keep responses clear and easy to read. Use emojis occasionally to keep it friendly.`;

    const chat = model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }]
        },
        {
          role: 'model',
          parts: [{ text: 'Got it! I am ready to help as a personal trainer and nutritionist for GymBuddy!' }]
        },
        ...history.map(h => ({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.content }]
        }))
      ]
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();
    res.json({ reply });
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