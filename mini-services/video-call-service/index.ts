import { Server } from 'socket.io'

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || '').split(',').filter(Boolean)

if (ALLOWED_ORIGINS.length === 0) {
  console.error('CORS_ORIGINS environment variable is required. Set it to comma-separated allowed origins (e.g., "http://localhost:3000,https://yourdomain.com")')
  process.exit(1)
}

const io = new Server({
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
  },
})

const PORT = 3005

// Track active rooms and peer connections
const rooms = new Map<string, {
  participants: Map<string, { name: string; avatar?: string; socketId: string }>
}>

io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId
  const userName = socket.handshake.auth.userName
  const userAvatar = socket.handshake.auth.userAvatar

  // Track which rooms this socket has joined
  const joinedRooms = new Set<string>()

  // Join a call room
  socket.on('call:join', ({ roomId }: { roomId: string }) => {
    socket.join(roomId)
    joinedRooms.add(roomId)

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { participants: new Map() })
    }
    const room = rooms.get(roomId)!
    room.participants.set(userId, { name: userName, avatar: userAvatar, socketId: socket.id })

    // Notify others in the room about the new peer
    const existingPeers = Array.from(room.participants.entries())
      .filter(([id]) => id !== userId)
      .map(([id, p]) => ({ peerId: id, peerName: p.name, peerAvatar: p.avatar }))

    socket.to(roomId).emit('call:peer-joined', {
      peerId: userId,
      peerName: userName,
      peerAvatar: userAvatar,
      existingPeers,
    })
  })

  // Leave a room explicitly
  socket.on('call:leave-room', ({ roomId }: { roomId: string }) => {
    socket.leave(roomId)
    joinedRooms.delete(roomId)
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId)!
      room.participants.delete(userId)
      socket.to(roomId).emit('call:peer-left', { peerId: userId })
      if (room.participants.size === 0) {
        rooms.delete(roomId)
      }
    }
  })

  // Relay WebRTC signaling — include sender metadata
  socket.on('call:signal', ({ roomId, targetId, signal }: { roomId: string; targetId: string; signal: unknown }) => {
    io.to(targetId).emit('call:signal', {
      fromId: userId,
      fromName: userName,
      fromAvatar: userAvatar,
      signal,
    })
  })

  // Outgoing call (ring) — direct call
  socket.on('call:ring', ({ targetId, callType, roomId }: { targetId: string; callType: 'audio' | 'video'; roomId: string }) => {
    io.to(targetId).emit('call:incoming', {
      fromId: userId,
      fromName: userName,
      fromAvatar: userAvatar,
      callType,
      roomId,
    })
  })

  // Group call ring — notify all group members
  socket.on('call:group-ring', ({ groupId, callType, roomId }: { groupId: string; callType: 'audio' | 'video'; roomId: string }) => {
    // Broadcast to all connected sockets in the room
    if (rooms.has(roomId)) {
      const room = rooms.get(roomId)!
      for (const [participantId] of room.participants) {
        if (participantId !== userId) {
          io.to(participantId).emit('call:incoming', {
            fromId: userId,
            fromName: userName,
            fromAvatar: userAvatar,
            callType,
            roomId,
          })
        }
      }
    }
  })

  // Call accepted — include metadata for the offerer to know who joined
  socket.on('call:accept', ({ targetId, roomId }: { targetId: string; roomId: string }) => {
    io.to(targetId).emit('call:accepted', {
      fromId: userId,
      fromName: userName,
      fromAvatar: userAvatar,
      roomId,
    })
  })

  // Call rejected
  socket.on('call:reject', ({ targetId }: { targetId: string }) => {
    io.to(targetId).emit('call:rejected', { fromId: userId })
  })

  // Call busy (recipient already on another call)
  socket.on('call:busy', ({ targetId, fromName }: { targetId: string; fromName: string }) => {
    io.to(targetId).emit('call:busy', { fromId: userId, fromName })
  })

  // Call ended
  socket.on('call:end', ({ roomId, targetId }: { roomId?: string; targetId?: string }) => {
    // Leave room
    if (roomId && rooms.has(roomId)) {
      const room = rooms.get(roomId)!
      room.participants.delete(userId)
      socket.to(roomId).emit('call:peer-left', { peerId: userId })
      if (room.participants.size === 0) {
        rooms.delete(roomId)
      }
    }

    // Notify specific target if provided
    if (targetId) {
      io.to(targetId).emit('call:ended', { fromId: userId })
    }

    // Also notify everyone in all joined rooms
    for (const rid of joinedRooms) {
      socket.to(rid).emit('call:ended', { fromId: userId })
      if (rooms.has(rid)) {
        const room = rooms.get(rid)!
        room.participants.delete(userId)
        socket.to(rid).emit('call:peer-left', { peerId: userId })
        if (room.participants.size === 0) rooms.delete(rid)
      }
      socket.leave(rid)
    }
    joinedRooms.clear()
  })

  // Toggle events (mic, camera, screen)
  socket.on('call:toggle-mic', ({ roomId, isOn }: { roomId: string; isOn: boolean }) => {
    socket.to(roomId).emit('call:peer-toggled', { peerId: userId, type: 'mic', isOn })
  })

  socket.on('call:toggle-camera', ({ roomId, isOn }: { roomId: string; isOn: boolean }) => {
    socket.to(roomId).emit('call:peer-toggled', { peerId: userId, type: 'camera', isOn })
  })

  socket.on('call:toggle-screen', ({ roomId, isOn }: { roomId: string; isOn: boolean }) => {
    socket.to(roomId).emit('call:peer-toggled', { peerId: userId, type: 'screen', isOn })
  })

  // Disconnect
  socket.on('disconnect', () => {
    for (const roomId of joinedRooms) {
      if (rooms.has(roomId)) {
        const room = rooms.get(roomId)!
        room.participants.delete(userId)
        io.to(roomId).emit('call:peer-left', { peerId: userId })
        io.to(roomId).emit('call:ended', { fromId: userId })
        if (room.participants.size === 0) rooms.delete(roomId)
      }
    }
    joinedRooms.clear()
  })
})

io.listen(PORT)
