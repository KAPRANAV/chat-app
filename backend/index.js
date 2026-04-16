const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { nanoid } = require('nanoid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// In-memory store (Replace with DB for production)
const users = new Map(); // socketID -> user
const profiles = new Map(); // userID -> {name, socketID, status, friends[]}
const relationships = new Map(); // userID -> Set(friendIDs)
const pendingRequests = new Map(); // userID -> Set(requesterIDs)

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('create-profile', ({ name }) => {
    const userId = `user#${nanoid(8)}`;
    const userProfile = {
      id: userId,
      name,
      socketId: socket.id,
      status: 'online'
    };
    
    profiles.set(userId, userProfile);
    users.set(socket.id, userId);
    relationships.set(userId, new Set());
    pendingRequests.set(userId, new Set());
    
    socket.emit('profile-created', userProfile);
    io.emit('user-status-change', { userId, status: 'online' });
  });

  socket.on('sync-session', ({ userId }) => {
    const profile = profiles.get(userId);
    if (profile) {
      profile.socketId = socket.id;
      profile.status = 'online';
      users.set(socket.id, userId);
      
      // Ensure Sets exist
      if (!relationships.has(userId)) relationships.set(userId, new Set());
      if (!pendingRequests.has(userId)) pendingRequests.set(userId, new Set());

      socket.emit('session-synced', profile);
      io.emit('user-status-change', { userId, status: 'online' });
    }
  });

  socket.on('get-initial-data', () => {
    const userId = users.get(socket.id);
    if (!userId) return;

    const friends = Array.from(relationships.get(userId) || []).map(fid => {
      const p = profiles.get(fid);
      return p ? { id: p.id, name: p.name, status: p.status } : null;
    }).filter(Boolean);

    const requests = Array.from(pendingRequests.get(userId) || []).map(rid => {
      const p = profiles.get(rid);
      return p ? { id: p.id, name: p.name } : null;
    }).filter(Boolean);

    socket.emit('initial-data', { friends, requests });
  });

  socket.on('send-friend-request', ({ toId }) => {
    const senderId = users.get(socket.id);
    if (!senderId || senderId === toId) return;

    let targetRequests = pendingRequests.get(toId);
    if (!targetRequests) {
      targetRequests = new Set();
      pendingRequests.set(toId, targetRequests);
    }
    targetRequests.add(senderId);
    const recipient = profiles.get(toId);
    if (recipient && recipient.socketId) {
      const sender = profiles.get(senderId);
      io.to(recipient.socketId).emit('incoming-request', { fromId: senderId, fromName: sender.name });
    }
  });

  socket.on('accept-friend-request', ({ fromId }) => {
    const userId = users.get(socket.id);
    if (!userId) return;

    // Remove from pending
    pendingRequests.get(userId)?.delete(fromId);

    // Add to friendships
    relationships.get(userId)?.add(fromId);
    relationships.get(fromId)?.add(userId); // Fixed bidirectional

    const userProfile = profiles.get(userId);
    const friendProfile = profiles.get(fromId);

    if (userProfile && friendProfile) {
      if (userProfile.socketId) {
        io.to(userProfile.socketId).emit('request-accepted', { friend: { id: friendProfile.id, name: friendProfile.name, status: friendProfile.status } });
      }
      if (friendProfile.socketId) {
        io.to(friendProfile.socketId).emit('request-accepted', { friend: { id: userProfile.id, name: userProfile.name, status: userProfile.status } });
      }
    }
  });

  socket.on('send-message', ({ to, content, type = 'text', mediaUrl = null }) => {
    const senderId = users.get(socket.id);
    if (!senderId) return;

    const recipient = profiles.get(to);
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('receive-message', {
        from: senderId,
        content,
        type,
        mediaUrl,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('typing', ({ to }) => {
    const senderId = users.get(socket.id);
    const recipient = profiles.get(to);
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('user-typing', { from: senderId });
    }
  });

  socket.on('stop-typing', ({ to }) => {
    const senderId = users.get(socket.id);
    const recipient = profiles.get(to);
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('user-stop-typing', { from: senderId });
    }
  });

  // PeerJS Signaling (PeerJS handles this largely, but we can track peerIds here)
  socket.on('initiate-call', ({ to, peerId, type }) => {
    const senderId = users.get(socket.id);
    const recipient = profiles.get(to);
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('incoming-call', {
        from: senderId,
        peerId,
        type // 'voice' | 'video'
      });
    }
  });

  // Gaming Logic - Tennis/Pong
  socket.on('game-move', ({ to, paddleY }) => {
    const senderId = users.get(socket.id);
    const recipient = profiles.get(to);
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('opponent-move', { paddleY });
    }
  });

  socket.on('game-move-special', ({ to, game, data }) => {
    const senderId = users.get(socket.id);
    const recipient = profiles.get(to);
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('game-move-special', { game, data });
    }
  });

  socket.on('game-invite', ({ to, game }) => {
    const senderId = users.get(socket.id);
    const recipient = profiles.get(to);
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('incoming-game', { from: senderId, game });
    }
  });

  socket.on('close-game', ({ to }) => {
    const senderId = users.get(socket.id);
    const recipient = profiles.get(to);
    if (recipient && recipient.socketId) {
      io.to(recipient.socketId).emit('close-game');
    }
  });

  socket.on('disconnect', () => {
    const userId = users.get(socket.id);
    if (userId) {
      const profile = profiles.get(userId);
      if (profile) {
        profile.status = 'offline';
        io.emit('user-status-change', { userId, status: 'offline' });
      }
      users.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
