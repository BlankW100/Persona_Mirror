const express = require('express');
const multer = require('multer');
const OpenAI = require('openai');
const { toFile } = require('openai');

const router = express.Router();

// Store audio in memory — Whisper limit is 25 MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

router.post('/', upload.single('audio'), async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'No audio received' });
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const audioFile = await toFile(
      req.file.buffer,
      'recording.webm',
      { type: req.file.mimetype || 'audio/webm' }
    );

    // Whisper transcribes verbatim — slang, profanity, and filler words included
    const text = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      response_format: 'text',
      language: 'en',
    });

    res.json({ text: text.trim() });
  } catch (err) {
    console.error('Whisper error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
