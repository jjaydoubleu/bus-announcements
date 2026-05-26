const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Trigger announcement endpoint
app.post('/generate', (req, res) => {
  try {
    const { type } = req.body;
    if (type !== '10min' && type !== 'now') {
      return res.json({ success: false, error: 'Unknown type' });
    }
    console.log(`Triggering ${type} announcement...`);
    io.emit('announce', { type });
    res.json({ success: true });
  } catch (err) {
    console.error('Error:', err);
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
