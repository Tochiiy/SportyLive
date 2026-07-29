const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { WebSocketServer } = require('ws');

const app = express();
app.use(express.json());
const server = http.createServer(app);

const io = new Server(server);
const wss = new WebSocketServer({ server });

app.get('/', (req, res) => {
  res.send('SportyLive backend');
});

io.on('connection', (socket) => {
  console.log('Socket.IO client connected');
});

wss.on('connection', (ws) => {
  console.log('WebSocket client connected');
});

server.listen(8080, () => {
  console.log('Server running on port 8080');
});
