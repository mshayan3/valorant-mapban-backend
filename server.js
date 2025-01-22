// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*', // Allow all origins (update this in production)
    methods: ['GET', 'POST'],
  },
});

const sessions = {}; // Store all sessions here

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Create a new session
  socket.on('create-session', (matchType, teamName, callback) => {
    const sessionId = Math.random().toString(36).substring(7); // Generate a unique session ID
    sessions[sessionId] = {
      matchType,
      maps: shuffleMaps().slice(0, 7), // Select 7 random maps
      bans: [],
      selectedMaps: [],
      currentTurn: null,
      tossWinner: null,
      tossLoser: null,
      teamA: { name: teamName, side: null },
      teamB: { name: '', side: null },
      isTossDone: false,
    };
    callback(sessionId);
    console.log(`Session created: ${sessionId}`);
  });

  // Join an existing session
  socket.on('join-session', (sessionId, teamName, callback) => {
    const session = sessions[sessionId];
    if (!session) {
      callback({ error: 'Session not found' });
      return;
    }
    session.teamB.name = teamName;
    socket.join(sessionId); // Join the session room
    callback(session);
    console.log(`User joined session: ${sessionId}`);
  });

  // Handle coin toss
  socket.on('handle-toss', (sessionId, call, callback) => {
    const session = sessions[sessionId];
    if (!session) {
      callback({ error: 'Session not found' });
      return;
    }
    const result = Math.random() < 0.5 ? 'heads' : 'tails';
    const isWin = call === result;

    session.tossWinner = isWin ? 'TeamA' : 'TeamB';
    session.tossLoser = isWin ? 'TeamB' : 'TeamA';
    session.currentTurn = session.matchType === 'bo1' ? 'TeamB' : 'TeamA';
    session.isTossDone = true;

    io.to(sessionId).emit('session-update', session); // Broadcast updated session data
    callback({ result, tossWinner: session.tossWinner });
  });

  // Handle map ban
  socket.on('ban-map', (sessionId, mapId) => {
    const session = sessions[sessionId];
    if (!session) return;
    const map = session.maps.find((m) => m.id === mapId);
    if (map && !map.banned) {
      map.banned = true;
      session.bans.push(mapId);
      session.currentTurn = session.currentTurn === 'TeamA' ? 'TeamB' : 'TeamA';
      io.to(sessionId).emit('session-update', session); // Broadcast updated session data
    }
  });

  // Handle map selection
  socket.on('select-map', (sessionId, mapId) => {
    const session = sessions[sessionId];
    if (!session) return;
    const map = session.maps.find((m) => m.id === mapId);
    if (map && !map.banned && !session.selectedMaps.includes(mapId)) {
      session.selectedMaps.push(mapId);
      session.currentTurn = session.currentTurn === 'TeamA' ? 'TeamB' : 'TeamA';
      io.to(sessionId).emit('session-update', session); // Broadcast updated session data
    }
  });

  // Handle side selection
  socket.on('select-side', (sessionId, team, side) => {
    const session = sessions[sessionId];
    if (!session) return;
    if (team === 'TeamA') {
      session.teamA.side = side;
      session.teamB.side = side === 'Attackers' ? 'Defenders' : 'Attackers';
    } else {
      session.teamB.side = side;
      session.teamA.side = side === 'Attackers' ? 'Defenders' : 'Attackers';
    }
    io.to(sessionId).emit('session-update', session); // Broadcast updated session data
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected:', socket.id);
  });
});

// Helper function to shuffle maps
function shuffleMaps() {
  const maps = [
    { id: 1, name: 'Bind', image: 'bind.webp' },
    { id: 2, name: 'Haven', image: 'haven.webp' },
    { id: 3, name: 'Split', image: 'split.webp' },
    { id: 4, name: 'Ascent', image: 'ascent.webp' },
    { id: 5, name: 'Icebox', image: 'icebox.webp' },
    { id: 6, name: 'Breeze', image: 'breeze.webp' },
    { id: 7, name: 'Fracture', image: 'fracture.webp' },
    { id: 8, name: 'Pearl', image: 'pearl.webp' },
    { id: 9, name: 'Lotus', image: 'lotus.webp' },
    { id: 10, name: 'Sunset', image: 'sunset.webp' },
    { id: 11, name: 'Abyss', image: 'abyss.webp' },
  ];
  return maps.sort(() => 0.5 - Math.random());
}

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});