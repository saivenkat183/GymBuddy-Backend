const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  date: { type: Date, default: Date.now },
  muscle: String,
  exercise: String,
  sets: [
    {
      weight: String,
      reps: String
    }
  ]
});

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name: { type: String, required: true },
  sessions: [sessionSchema]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);