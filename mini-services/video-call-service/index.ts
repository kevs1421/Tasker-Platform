import { Server } from 'socket.io'

const io = new Server({
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const PORT = 3005

// Track active rooms and peer connections
const rooms = new Map<string, {
  participants: Map<string, { name: string; avatar?: string; streamId?: string }>
}>

io.on('connection', (socket) => {
  const userId = socket.handshake.auth.userId
  const userName = socket.handshake.auth.userName
  const userAvatar = socket.handshake.auth.userAvatar

  console.log(`[VC] ${userName} (${userId}) connected`)

  // Join a call room
  socket.on('call:join', ({ roomId }: { roomId: string }) => {
    socket.join(roomId)

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { participants: new Map() })
    }
    const room = rooms.get(roomId)!
    room.participants.set(userId, { name: userName, avatar: userAvatar })

    // Notify others in the room
    socket.to(roomId).emit('call:peer-joined', {
      peerId: userId,
      peerName: userName,
      peerAvatar: userAvatar,
      existingPeers: Array.from(room.participants.entries())
        .filter(([id]) => id !== userId)
        .map(([id, p]) => ({ peerId: id, peerName: p.name, peerAvatar: p.avatar })),
    })

    console.log(`[VC] ${userName} joined room ${roomId} (${room.participants.size} total)`)
  })

  // Relay WebRTC signaling
  socket.on('call:signal', ({ roomId, targetId, signal }: { roomId: string; targetId: string; signal: unknown }) => {
    console.log(`[VC] Signal from ${userId} to ${targetId} in ${roomId}`)
    io.to(targetId).emit('call:signal', {
      fromId: userId,
      signal,
    })
  })

  // Outgoing call (ring)
  socket.on('call:ring', ({ targetId, callType, roomId }: { targetId: string; callType: 'audio' | 'video'; roomId: string }) => {
    console.log(`[VC] ${userName} ringing ${targetId} (${callType})`)
    io.to(targetId).emit('call:incoming', {
      fromId: userId,
      fromName: userName,
      fromAvatar: userAvatar,
      callType,
      roomId,
    })
  })

  // Call accepted
  socket.on('call:accept', ({ targetId, roomId }: { targetId: string; roomId: string }) => {
    console.log(`[VC] ${userName} accepted call from ${targetId}`)
    io.to(targetId).emit('call:accepted', {
      fromId: userId,
      roomId,
    })
  })

  // Call rejected
  socket.on('call:reject', ({ targetId }: { targetId: string }) => {
    console.log(`[VC] ${userName} rejected call from ${targetId}`)
    io.to(targetId).emit('call:rejected', {
      fromId: userId,
    })
  })

  // Call ended
  socket.on('call:end', ({ roomId, targetId }: { roomId?: string; targetId?: string }) => {
    console.log(`[VC] ${userName} ended call`)

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

    socket.leave(roomId || '')
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
    console.log(`[VC] ${userName} (${userId}) disconnected`)
    // Clean up all rooms this user is in
    for (const [roomId, room] of rooms.entries()) {
      if (room.participants.has(userId)) {
        room.participants.delete(userId)
        socket.to(roomId).emit('call:peer-left', { peerId: userId })
        if (room.participants.size === 0) {
          rooms.delete(roomId)
        }
      }
    }
  })
})

io.listen(PORT)
console.log(`[VC] Video call signaling service running on port ${PORT}`)
