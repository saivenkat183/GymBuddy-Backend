const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
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

// GET /api/users/me/counts — my follower/following counts
router.get('/me/counts', auth, async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('followers following');
    res.json({
      followersCount: me.followers.length,
      followingCount: me.following.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/users/search?q= — search users by name or username
router.get('/search', auth, async (req, res) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 1) return res.json([]);

    const users = await User.find({
      $or: [
        { username: { $regex: q, $options: 'i' } },
        { name: { $regex: q, $options: 'i' } }
      ],
      username: { $ne: req.user.username }
    }).select('username name followers following sessions').limit(20);

    const me = await User.findById(req.user.id).select('following');
    const myFollowingIds = me.following.map(id => id.toString());

    const result = users.map(u => ({
      username: u.username,
      name: u.name,
      followersCount: u.followers.length,
      followingCount: u.following.length,
      totalWorkouts: u.sessions.length,
      isFollowing: myFollowingIds.includes(u._id.toString())
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// GET /api/users/:username/profile — public profile
router.get('/:username/profile', auth, async (req, res) => {
  try {
    const target = await User.findOne({ username: req.params.username })
      .select('username name followers following sessions createdAt');

    if (!target) return res.status(404).json({ message: 'User not found' });

    const me = await User.findById(req.user.id).select('following');
    const isFollowing = me.following.map(id => id.toString()).includes(target._id.toString());

    const totalWorkouts = target.sessions.length;
    const totalSets = target.sessions.reduce((sum, s) => sum + s.sets.length, 0);
    const musclesTrained = [...new Set(target.sessions.map(s => s.muscle))].length;

    // Top 3 PRs by weight
    const prMap = {};
    target.sessions.forEach(s => {
      s.sets.forEach(set => {
        const w = parseFloat(set.weight || 0);
        if (!prMap[s.exercise] || w > prMap[s.exercise].weight) {
          prMap[s.exercise] = { weight: w, reps: parseInt(set.reps || 0), muscle: s.muscle };
        }
      });
    });
    const topPRs = Object.entries(prMap)
      .sort((a, b) => b[1].weight - a[1].weight)
      .slice(0, 3)
      .map(([exercise, pr]) => ({ exercise, ...pr }));

    // Last 5 sessions
    const recentSessions = [...target.sessions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5)
      .map(s => ({
        muscle: s.muscle,
        exercise: s.exercise,
        sets: s.sets.length,
        date: s.date
      }));

    res.json({
      username: target.username,
      name: target.name,
      followersCount: target.followers.length,
      followingCount: target.following.length,
      isFollowing,
      isSelf: req.user.username === target.username,
      stats: { totalWorkouts, totalSets, musclesTrained },
      topPRs,
      recentSessions,
      memberSince: target.createdAt
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// POST /api/users/:username/follow — follow or unfollow toggle
router.post('/:username/follow', auth, async (req, res) => {
  try {
    if (req.params.username === req.user.username) {
      return res.status(400).json({ message: 'You cannot follow yourself' });
    }

    const target = await User.findOne({ username: req.params.username });
    if (!target) return res.status(404).json({ message: 'User not found' });

    const me = await User.findById(req.user.id);
    const alreadyFollowing = me.following.map(id => id.toString()).includes(target._id.toString());

    if (alreadyFollowing) {
      me.following = me.following.filter(id => id.toString() !== target._id.toString());
      target.followers = target.followers.filter(id => id.toString() !== me._id.toString());
    } else {
      me.following.push(target._id);
      target.followers.push(me._id);
    }

    await me.save();
    await target.save();

    res.json({
      following: !alreadyFollowing,
      followersCount: target.followers.length
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;