'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'
import type { User } from '@/types'

const SIGNAL_URL = '/?XTransformPort=3005'

// ─── Types ────────────────────────────────────────────────────────────

interface PeerState {
  userId: string
  userName: string
  userAvatar?: string
  pc: RTCPeerConnection
  remoteStream: MediaStream
  remoteScreenStream: MediaStream
  micOn: boolean
  cameraOn: boolean
  screenOn: boolean
}

// ─── Hook ─────────────────────────────────────────────────────────────

export function useVideoCall(currentUser: User | null) {
  const socketRef = useRef<Socket | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const localScreenStreamRef = useRef<MediaStream | null>(null)
  const peersRef = useRef<Map<string, PeerState>>(new Map())
  const iceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map())

  // The stream that we actually send to peers (may be virtual-bg processed)
  const sendStreamRef = useRef<MediaStream | null>(null)

  // Stable refs for use inside callbacks without stale closures
  const roomIdRef = useRef('')
  const currentUserRef = useRef<User | null>(null)
  const callTypeRef = useRef<'audio' | 'video'>('video')
  const isInitiatorRef = useRef(false)
  const isInCallRef = useRef(false)

  const [isInCall, setIsInCall] = useState(false)

  // Sync isInCallRef for socket handlers
  useEffect(() => {
    isInCallRef.current = isInCall
  }, [isInCall])
  const [callType, setCallType] = useState<'audio' | 'video'>('video')
  const [callStatus, setCallStatus] = useState<'ringing' | 'connected' | 'connecting'>('ringing')
  const [remoteUser, setRemoteUser] = useState<User | null>(null)
  const [roomId, setRoomId] = useState('')
  const [incomingCall, setIncomingCall] = useState<{
    caller: User
    callType: 'audio' | 'video'
    roomId: string
  } | null>(null)
  const [micOn, setMicOn] = useState(true)
  const [cameraOn, setCameraOn] = useState(true)
  const [screenOn, setScreenOn] = useState(false)
  const [remoteScreenOn, setRemoteScreenOn] = useState(false)
  const [remoteMicOn, setRemoteMicOn] = useState(true)
  const [remoteCameraOn, setRemoteCameraOn] = useState(true)
  const [screenShareLabel, setScreenShareLabel] = useState('')

  // Sync refs
  const syncRoomId = (id: string) => { setRoomId(id); roomIdRef.current = id }

  // ── WebRTC helpers ──

  const doCreatePeerConnection = useCallback(async (peerId: string, peerName: string, peerAvatar?: string): Promise<RTCPeerConnection> => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    }
    const pc = new RTCPeerConnection(config)

    const remoteStream = new MediaStream()
    const remoteScreenStream = new MediaStream()

    // Add local media tracks to peer connection
    // Use sendStreamRef (which may be the virtual background processed stream)
    // if available, otherwise use the raw localStream
    const streamToAdd = sendStreamRef.current || localStreamRef.current
    if (streamToAdd) {
      streamToAdd.getTracks().forEach((track) => {
        pc.addTrack(track, streamToAdd)
      })
    }
    // Add screen tracks to peer connection (separate sender)
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localScreenStreamRef.current!)
      })
    }

    pc.ontrack = (event) => {
      const track = event.track
      // Screen share tracks from the remote are identified by containing 'screen' in their label
      // or by the transceiver's mid (we use a dedicated transceiver)
      if (track.label.toLowerCase().includes('screen') || event.transceiver?.sender?.track?.label.toLowerCase().includes('screen')) {
        remoteScreenStream.addTrack(track)
      } else {
        remoteStream.addTrack(track)
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('call:signal', {
          roomId: roomIdRef.current,
          targetId: peerId,
          signal: event.candidate.toJSON(),
        })
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        setCallStatus('connected')
      } else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        toast.error('Connection lost')
        // Direct cleanup instead of calling function to avoid hoisting issue
        const peer = peersRef.current.get(peerId)
        if (peer) {
          peer.remoteStream.getTracks().forEach((t) => t.stop())
          peer.remoteScreenStream.getTracks().forEach((t) => t.stop())
          peer.pc.close()
          peersRef.current.delete(peerId)
        }
        iceCandidatesRef.current.delete(peerId)
      }
    }

    // Store peer state
    const peerState: PeerState = {
      userId: peerId,
      userName: peerName,
      userAvatar: peerAvatar,
      pc,
      remoteStream,
      remoteScreenStream,
      micOn: true,
      cameraOn: true,
      screenOn: false,
    }
    peersRef.current.set(peerId, peerState)

    return pc
  }, [])

  const cleanupPeer = useCallback((peerId: string) => {
    const peer = peersRef.current.get(peerId)
    if (peer) {
      peer.remoteStream.getTracks().forEach((t) => t.stop())
      peer.remoteScreenStream.getTracks().forEach((t) => t.stop())
      peer.pc.close()
      peersRef.current.delete(peerId)
    }
    // Clear pending ICE candidates
    iceCandidatesRef.current.delete(peerId)
  }, [])

  const doHandleOffer = useCallback(async (fromId: string, fromName: string, fromAvatar: string | undefined, signal: RTCSessionDescriptionInit) => {
    const pc = await doCreatePeerConnection(fromId, fromName, fromAvatar)
    await pc.setRemoteDescription(new RTCSessionDescription(signal))
    // Drain buffered ICE candidates
    const buffered = iceCandidatesRef.current.get(fromId) || []
    for (const candidate of buffered) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
    iceCandidatesRef.current.delete(fromId)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socketRef.current?.emit('call:signal', { roomId: roomIdRef.current, targetId: fromId, signal: answer })
  }, [doCreatePeerConnection])

  const doHandleAnswer = useCallback(async (signal: RTCSessionDescriptionInit, fromId: string) => {
    const peer = peersRef.current.get(fromId)
    if (!peer) return
    await peer.pc.setRemoteDescription(new RTCSessionDescription(signal))
    const buffered = iceCandidatesRef.current.get(fromId) || []
    for (const candidate of buffered) {
      await peer.pc.addIceCandidate(new RTCIceCandidate(candidate))
    }
    iceCandidatesRef.current.delete(fromId)
  }, [])

  const doHandleIceCandidate = useCallback(async (signal: RTCIceCandidateInit, fromId: string) => {
    const peer = peersRef.current.get(fromId)
    if (peer?.pc.remoteDescription) {
      await peer.pc.addIceCandidate(new RTCIceCandidate(signal))
    } else {
      const existing = iceCandidatesRef.current.get(fromId) || []
      existing.push(signal)
      iceCandidatesRef.current.set(fromId, existing)
    }
  }, [])

  // ── Local Stream Management ──

  const getLocalStream = useCallback(async (type: 'audio' | 'video') => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false,
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      setMicOn(true)
      setCameraOn(type === 'video')
      // Attach to video element
      requestAnimationFrame(() => {
        const localVideo = document.querySelector('#local-video') as HTMLVideoElement
        if (localVideo) localVideo.srcObject = stream
      })
      return stream
    } catch {
      toast.error('Could not access camera/microphone')
      return null
    }
  }, [])

  const doEndCall = useCallback(() => {
    // Stop all local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop())
      localStreamRef.current = null
    }
    if (localScreenStreamRef.current) {
      localScreenStreamRef.current.getTracks().forEach((t) => t.stop())
      localScreenStreamRef.current = null
    }
    // Stop virtual background send stream tracks (these are canvas-captured, not raw)
    if (sendStreamRef.current) {
      sendStreamRef.current.getTracks().forEach((t) => t.stop())
      sendStreamRef.current = null
    }
    // Clean up all peers
    for (const [peerId] of peersRef.current) {
      cleanupPeer(peerId)
    }
    iceCandidatesRef.current.clear()

    // Leave room via socket (only if we have a room)
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('call:end', { roomId: roomIdRef.current })
      socketRef.current.emit('call:leave-room', { roomId: roomIdRef.current })
    }

    // Clear video elements
    requestAnimationFrame(() => {
      const localVideo = document.querySelector('#local-video') as HTMLVideoElement
      if (localVideo) localVideo.srcObject = null
      const localScreenVideo = document.querySelector('#local-screen-video') as HTMLVideoElement
      if (localScreenVideo) localScreenVideo.srcObject = null
      const remoteVideo = document.querySelector('#remote-video') as HTMLVideoElement
      if (remoteVideo) remoteVideo.srcObject = null
      const remoteScreenVideo = document.querySelector('#remote-screen-video') as HTMLVideoElement
      if (remoteScreenVideo) remoteScreenVideo.srcObject = null
    })

    // Reset all state
    setIsInCall(false)
    setCallStatus('ringing')
    setRemoteUser(null)
    setRoomId('')
    setMicOn(true)
    setCameraOn(true)
    setScreenOn(false)
    setRemoteScreenOn(false)
    setRemoteMicOn(true)
    setRemoteCameraOn(true)
    setScreenShareLabel('')
    roomIdRef.current = ''
    isInitiatorRef.current = false
  }, [cleanupPeer])

  // ── Socket connection ──

  useEffect(() => {
    if (!currentUser) return
    currentUserRef.current = currentUser

    const socket = io(SIGNAL_URL, {
      auth: {
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.avatar || undefined,
      },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    // Incoming call — handle call-in-call by auto-rejecting with busy notification
    socket.on('call:incoming', ({ fromId, fromName, fromAvatar, callType: ct, roomId: rid }) => {
      // If already on a call, auto-reject and notify both parties
      if (isInCallRef.current) {
        // Send busy signal back to caller
        socket.emit('call:busy', { targetId: fromId, fromName: currentUser.name })
        // Show notification to user that they missed a call
        toast.info(`${fromName} tried to call you while you're on another call`)
        return
      }
      setIncomingCall({
        caller: { id: fromId, name: fromName, avatar: fromAvatar, email: '', role: 'team' as const, status: 'active', createdAt: '', updatedAt: '' },
        callType: ct,
        roomId: rid,
      })
    })

    // Call accepted — initiator creates offer
    socket.on('call:accepted', async ({ fromId, fromName, fromAvatar, roomId: rid }) => {
      setCallStatus('connecting')
      const pc = await doCreatePeerConnection(fromId, fromName, fromAvatar)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:signal', { roomId: rid, targetId: fromId, signal: offer })
    })

    socket.on('call:rejected', () => { toast.error('Call rejected'); doEndCall() })
    socket.on('call:busy', ({ fromName }: { fromName: string }) => {
      toast.error(`${fromName} is on another call`)
      doEndCall()
    })
    socket.on('call:ended', () => { toast.info('Call ended'); doEndCall() })

    // WebRTC signaling
    socket.on('call:signal', async ({ fromId, fromName, fromAvatar, signal }) => {
      if (signal.type === 'offer') {
        await doHandleOffer(fromId, fromName, fromAvatar, signal)
      } else if (signal.type === 'answer') {
        await doHandleAnswer(signal, fromId)
      } else if (signal.candidate) {
        await doHandleIceCandidate(signal, fromId)
      }
    })

    // Peer state updates
    socket.on('call:peer-toggled', ({ peerId, type, isOn }: { peerId: string; type: string; isOn: boolean }) => {
      if (type === 'mic') setRemoteMicOn(isOn)
      else if (type === 'camera') setRemoteCameraOn(isOn)
      else if (type === 'screen') {
        setRemoteScreenOn(isOn)
        if (!isOn) {
          requestAnimationFrame(() => {
            const el = document.querySelector('#remote-screen-video') as HTMLVideoElement
            if (el) el.srcObject = null
          })
        }
      }
    })

    // Peer joined group call
    socket.on('call:peer-joined', async ({ peerId, peerName, peerAvatar }: { peerId: string; peerName: string; peerAvatar?: string }) => {
      if (!isInitiatorRef.current) return // Only initiator creates offers to new peers
      const pc = await doCreatePeerConnection(peerId, peerName, peerAvatar)
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:signal', { roomId: roomIdRef.current, targetId: peerId, signal: offer })
    })

    // Peer left
    socket.on('call:peer-left', ({ peerId }: { peerId: string }) => {
      cleanupPeer(peerId)
    })

    return () => { socket.disconnect(); socketRef.current = null }
  }, [currentUser, doCreatePeerConnection, doHandleOffer, doHandleAnswer, doHandleIceCandidate, doEndCall, cleanupPeer])

  // ── Attach remote streams to video elements when they change ──

  useEffect(() => {
    if (!isInCall || callStatus !== 'connected') return
    const attachInterval = setInterval(() => {
      for (const [, peer] of peersRef.current) {
        const remoteVideo = document.querySelector('#remote-video') as HTMLVideoElement
        if (remoteVideo && peer.remoteStream.getTracks().length > 0 && !remoteVideo.srcObject) {
          remoteVideo.srcObject = peer.remoteStream
        }
        const remoteScreenVideo = document.querySelector('#remote-screen-video') as HTMLVideoElement
        if (remoteScreenVideo && peer.remoteScreenStream.getTracks().length > 0 && !remoteScreenVideo.srcObject) {
          remoteScreenVideo.srcObject = peer.remoteScreenStream
        }
      }
    }, 500)
    return () => clearInterval(attachInterval)
  }, [isInCall, callStatus])

  // ── Public Actions ──

  const startCall = useCallback(async (target: User, type: 'audio' | 'video') => {
    if (!currentUser || !socketRef.current?.connected) {
      toast.error('Not connected to call service')
      return
    }
    callTypeRef.current = type
    setCallType(type)
    setRemoteUser(target)
    setCallStatus('ringing')
    setIsInCall(true)
    isInitiatorRef.current = true
    const rid = `${currentUser.id}-${target.id}-${Date.now()}`
    syncRoomId(rid)
    const stream = await getLocalStream(type)
    if (!stream) { setIsInCall(false); return }
    socketRef.current.emit('call:join', { roomId: rid })
    socketRef.current.emit('call:ring', { targetId: target.id, callType: type, roomId: rid })
    toast.info(`Calling ${target.name}...`)
  }, [currentUser, getLocalStream])

  const startGroupCall = useCallback(async (groupId: string, groupName: string, type: 'audio' | 'video') => {
    if (!currentUser || !socketRef.current?.connected) {
      toast.error('Not connected to call service')
      return
    }
    callTypeRef.current = type
    setCallType(type)
    setRemoteUser({ id: groupId, name: groupName, email: '', role: 'team' as const, status: 'active', createdAt: '', updatedAt: '' })
    setCallStatus('connecting')
    setIsInCall(true)
    isInitiatorRef.current = true
    const rid = `group-${groupId}-${Date.now()}`
    syncRoomId(rid)
    const stream = await getLocalStream(type)
    if (!stream) { setIsInCall(false); return }
    socketRef.current.emit('call:join', { roomId: rid })
    socketRef.current.emit('call:group-ring', { groupId, callType: type, roomId: rid })
    toast.info(`Starting ${type} call in ${groupName}...`)
    setCallStatus('connected')
  }, [currentUser, getLocalStream])

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !currentUser || !socketRef.current) return
    const { caller, callType: ct, roomId: rid } = incomingCall
    callTypeRef.current = ct
    setCallType(ct)
    setRemoteUser(caller)
    setCallStatus('connecting')
    setIsInCall(true)
    isInitiatorRef.current = false
    syncRoomId(rid)
    setIncomingCall(null)
    const stream = await getLocalStream(ct)
    if (!stream) { setIsInCall(false); setIncomingCall(null); return }
    socketRef.current.emit('call:join', { roomId: rid })
    socketRef.current.emit('call:accept', { targetId: caller.id, roomId: rid, userName: currentUser.name, userAvatar: currentUser.avatar })
    setCallStatus('connected')
    toast.success('Call connected')
  }, [incomingCall, currentUser, getLocalStream])

  const rejectCall = useCallback(() => {
    if (!incomingCall || !socketRef.current) return
    socketRef.current.emit('call:reject', { targetId: incomingCall.caller.id })
    setIncomingCall(null)
    toast.info('Call rejected')
  }, [incomingCall])

  const endCall = useCallback(() => { doEndCall() }, [doEndCall])

  const toggleMic = useCallback(() => {
    const audioTrack = localStreamRef.current?.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      setMicOn(audioTrack.enabled)
    }
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('call:toggle-mic', { roomId: roomIdRef.current, isOn: !micOn })
    }
  }, [micOn])

  const toggleCamera = useCallback(() => {
    const videoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      setCameraOn(videoTrack.enabled)
    }
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('call:toggle-camera', { roomId: roomIdRef.current, isOn: !cameraOn })
    }
  }, [cameraOn])

  const toggleScreen = useCallback(async () => {
    if (screenOn) {
      // ── Stop screen share ──
      if (localScreenStreamRef.current) {
        localScreenStreamRef.current.getTracks().forEach((t) => t.stop())
        localScreenStreamRef.current = null
      }
      // Remove screen share senders from all peer connections
      for (const [, peer] of peersRef.current) {
        const senders = peer.pc.getSenders()
        const screenSender = senders.find((s) => s.track?.label.toLowerCase().includes('screen'))
        if (screenSender) {
          peer.pc.removeTrack(screenSender)
          // Renegotiate to remove the track
          const offer = await peer.pc.createOffer()
          await peer.pc.setLocalDescription(offer)
          socketRef.current?.emit('call:signal', {
            roomId: roomIdRef.current,
            targetId: peer.userId,
            signal: offer,
          })
        }
      }
      // Clear local screen video element
      requestAnimationFrame(() => {
        const el = document.querySelector('#local-screen-video') as HTMLVideoElement
        if (el) el.srcObject = null
      })
      setScreenOn(false)
      setScreenShareLabel('')
      toast.success('Screen sharing stopped')
    } else {
      // ── Start screen share ──
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as MediaTrackConstraints,
          audio: false,
        })
        const screenTrack = screenStream.getVideoTracks()[0]
        localScreenStreamRef.current = screenStream
        setScreenShareLabel(screenTrack.label || 'Screen')

        // Add screen track to all peer connections as a new sender
        for (const [, peer] of peersRef.current) {
          peer.pc.addTrack(screenTrack, screenStream)
          // Renegotiate to add the new track
          const offer = await peer.pc.createOffer()
          await peer.pc.setLocalDescription(offer)
          socketRef.current?.emit('call:signal', {
            roomId: roomIdRef.current,
            targetId: peer.userId,
            signal: offer,
          })
        }

        // Auto-stop when user clicks browser's stop sharing
        screenTrack.onended = () => {
          if (localScreenStreamRef.current) {
            localScreenStreamRef.current.getTracks().forEach((t) => t.stop())
            localScreenStreamRef.current = null
          }
          // Remove from peer connections
          for (const [, peer] of peersRef.current) {
            const senders = peer.pc.getSenders()
            const screenSender = senders.find((s) => s.track?.label.toLowerCase().includes('screen'))
            if (screenSender) peer.pc.removeTrack(screenSender)
          }
          setScreenOn(false)
          setScreenShareLabel('')
          socketRef.current?.emit('call:toggle-screen', { roomId: roomIdRef.current, isOn: false })
          toast.success('Screen sharing stopped')
        }

        // Attach local screen to video element
        requestAnimationFrame(() => {
          const localScreenVideo = document.querySelector('#local-screen-video') as HTMLVideoElement
          if (localScreenVideo) localScreenVideo.srcObject = screenStream
        })

        setScreenOn(true)
        toast.success('Screen sharing started')
      } catch (err) {
        if ((err as DOMException).name !== 'AbortError') {
          toast.error('Could not share screen')
        }
      }
    }
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('call:toggle-screen', { roomId: roomIdRef.current, isOn: !screenOn })
    }
  }, [screenOn])

  // ── Virtual Background: replace the video track sent to peers ──

  /**
   * Apply a virtual background processed stream.
   * This replaces the video track in all peer connections with the
   * processed canvas track, while keeping the raw audio track.
   */
  const applyVirtualBackgroundStream = useCallback(async (processedStream: MediaStream) => {
    sendStreamRef.current = processedStream

    // Get the processed video track
    const processedVideoTrack = processedStream.getVideoTracks()[0]
    if (!processedVideoTrack) return

    // Replace the video track in all peer connections
    for (const [, peer] of peersRef.current) {
      const senders = peer.pc.getSenders()
      const videoSender = senders.find((s) => {
        const track = s.track
        return track && track.kind === 'video' && !track.label.toLowerCase().includes('screen')
      })
      if (videoSender) {
        try {
          await videoSender.replaceTrack(processedVideoTrack)
        } catch {
          // replaceTrack may fail if codecs don't match; fall back to renegotiation
          peer.pc.removeTrack(videoSender)
          peer.pc.addTrack(processedVideoTrack, processedStream)
          const offer = await peer.pc.createOffer()
          await peer.pc.setLocalDescription(offer)
          socketRef.current?.emit('call:signal', {
            roomId: roomIdRef.current,
            targetId: peer.userId,
            signal: offer,
          })
        }
      }
    }
  }, [])

  /**
   * Remove virtual background — switch back to the raw camera track.
   */
  const removeVirtualBackgroundStream = useCallback(async () => {
    sendStreamRef.current = null

    const rawVideoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (!rawVideoTrack) return

    // Replace back to the raw video track in all peer connections
    for (const [, peer] of peersRef.current) {
      const senders = peer.pc.getSenders()
      const videoSender = senders.find((s) => {
        const track = s.track
        return track && track.kind === 'video' && !track.label.toLowerCase().includes('screen')
      })
      if (videoSender) {
        try {
          await videoSender.replaceTrack(rawVideoTrack)
        } catch {
          // Fall back to renegotiation
          peer.pc.removeTrack(videoSender)
          if (localStreamRef.current) {
            peer.pc.addTrack(rawVideoTrack, localStreamRef.current)
          }
          const offer = await peer.pc.createOffer()
          await peer.pc.setLocalDescription(offer)
          socketRef.current?.emit('call:signal', {
            roomId: roomIdRef.current,
            targetId: peer.userId,
            signal: offer,
          })
        }
      }
    }
  }, [])

  // Expose the raw local stream for virtual background processing
  const getLocalStreamRef = useCallback(() => localStreamRef.current, [])

  return {
    isInCall, callType, callStatus, remoteUser, incomingCall,
    micOn, cameraOn, screenOn, remoteScreenOn, remoteMicOn, remoteCameraOn,
    screenShareLabel,
    startCall, startGroupCall, acceptCall, rejectCall, endCall,
    toggleMic, toggleCamera, toggleScreen,
    applyVirtualBackgroundStream, removeVirtualBackgroundStream,
    getLocalStreamRef,
  }
}
