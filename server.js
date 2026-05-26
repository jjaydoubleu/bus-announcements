const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json({ limit: '20mb' }));
app.use(express.static(path.join(__dirname)));

// ElevenLabs voice IDs
const VOICES = {
  english:  '21m00Tcm4TlvDq8ikWAM', // Rachel
  mandarin: 'XB0fDUnXU5powFXDhCwa'  // Charlotte
};

// Cache generated audio to avoid regenerating same announcements
const audioCache = {};

// Generate audio from ElevenLabs
async function generateAudio(text, voiceId) {
  const cacheKey = `${voiceId}-${text}`;
  if (audioCache[cacheKey]) return audioCache[cacheKey];

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
    })
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs error: ${err}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  audioCache[cacheKey] = base64;
  return base64;
}

// Generate announcement endpoint
app.post('/generate', async (req, res) => {
  try {
    const { type } = req.body;

    let englishText, mandarinText;

    if (type === '10min') {
      englishText  = 'Attention passengers. The next bus to Queenstown departs in 10 minutes. Please make your way to the carpark.';
      mandarinText = '各位乘客请注意。前往皇后镇的下一班巴士将在10分钟后出发。请前往停车场。';
    } else if (type === 'now') {
      englishText  = 'Attention passengers. The bus to Queenstown is now departing. Please make your way to the carpark immediately.';
      mandarinText = '各位乘客请注意。前往皇后镇的巴士现在出发。请立即前往停车场。';
    } else {
      return res.json({ success: false, error: 'Unknown announcement type' });
    }

    console.log(`Generating ${type} announcement...`);
    const [englishAudio, mandarinAudio] = await Promise.all([
      generateAudio(englishText, VOICES.english),
      generateAudio(mandarinText, VOICES.mandarin)
    ]);

    // Broadcast to all speaker devices
    io.emit('announce', { type, englishAudio, mandarinAudio });
    res.json({ success: true });

  } catch (err) {
    console.error('Generate error:', err);
    res.json({ success: false, error: err.message });
  }
});

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.on('disconnect', () => console.log('Client disconnected:', socket.id));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Bus Announcements running on port ${PORT}\n`);
});
