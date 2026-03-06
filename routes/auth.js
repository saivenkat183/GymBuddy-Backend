const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { username, password, name } = req.body;

    // Check if user exists
    const existing = await User.findOne({ username });
    if (existing) return res.status(400).json({ message: 'Username already taken' });

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Create user
    const user = new User({ username, password: hashed, name, sessions: [] });
    await user.save();

    // Generate token
    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, name: user.name, username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find user
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    // Check password
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    // Generate token
    const token = jwt.sign({ id: user._id, username }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({ token, name: user.name, username: user.username });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;