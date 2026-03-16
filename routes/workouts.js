const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware to verify token
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// GET all sessions for logged in user
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user.sessions);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST save a new workout session
router.post('/', auth, async (req, res) => {
  try {
    const { muscle, exercise, sets, date } = req.body;
    const session = { muscle, exercise, sets, date: date ? new Date(date) : new Date() };
    const user = await User.findById(req.user.id);
    user.sessions.push(session);
    await user.save();
    // Return the saved subdocument with its proper MongoDB _id
    const savedSession = user.sessions[user.sessions.length - 1];
    res.json({ message: 'Workout saved!', session: savedSession });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ─── LEADERBOARD MUST BE ABOVE /:sessionId — otherwise Express treats
//     "leaderboard" as a sessionId param and it never gets reached ─────────────
router.get('/leaderboard', auth, async (req, res) => {
  try {
    const { muscle } = req.query;
    const users = await User.find({});
    const entries = [];
    users.forEach(u => {
      u.sessions.forEach(s => {
        if (muscle && muscle !== 'all' && s.muscle !== muscle) return;
        s.sets.forEach(set => {
          entries.push({
            username: u.username,
            name: u.name,
            muscle: s.muscle,
            exercise: s.exercise,
            weight: parseFloat(set.weight || 0)
          });
        });
      });
    });
    const top = entries.sort((a, b) => b.weight - a.weight).slice(0, 10);
    res.json(top);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// DELETE a workout session
router.delete('/:sessionId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.sessions = user.sessions.filter(s => s._id.toString() !== req.params.sessionId);
    await user.save();
    res.json({ message: 'Session deleted!' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;