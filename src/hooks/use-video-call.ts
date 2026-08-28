'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import { toast } from 'sonner'
import type { User } from '@/types'

const SIGNAL_URL = '/?XTransformPort=3005'

export function useVideoCall(currentUser: User | null) {
  const socketRef = useRef<Socket | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const remoteStreamRef = useRef<MediaStream | null>(null)
  const iceCandidatesRef = useRef<unknown[]>([])

  // Use refs for stable function references inside useEffect
  const roomIdRef = useRef('')
  const remoteUserRef = useRef<User | null>(null)

  const [isInCall, setIsInCall] = useState(false)
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

  const syncState = (updates: { roomId?: string; remoteUser?: User | null }) => {
    if (updates.roomId !== undefined) {
      setRoomId(updates.roomId)
      roomIdRef.current = updates.roomId
    }
    if (updates.remoteUser !== undefined) {
      setRemoteUser(updates.remoteUser)
      remoteUserRef.current = updates.remoteUser
    }
  }

  // ── WebRTC helpers (non-hook, plain functions using refs) ──

  const doCreatePeerConnection = async (remotePeerId: string, rid: string): Promise<RTCPeerConnection> => {
    const config: RTCConfiguration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
      ],
    }
    const pc = new RTCPeerConnection(config)
    pcRef.current = pc

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!)
      })
    }

    const remoteStream = new MediaStream()
    remoteStreamRef.current = remoteStream

    pc.ontrack = (event) => {
      event.streams[0]?.getTracks().forEach((track) => remoteStream.addTrack(track))
      const remoteVideo = document.querySelector('#remote-video') as HTMLVideoElement
      if (remoteVideo) remoteVideo.srcObject = remoteStream
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('call:signal', { roomId: rid, targetId: remotePeerId, signal: event.candidate.toJSON() })
      }
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'connected') setCallStatus('connected')
      else if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        toast.error('Connection lost')
        doEndCall()
      }
    }

    return pc
  }

  const doHandleOffer = async (fromId: string, signal: RTCSessionDescriptionInit, rid: string) => {
    const pc = await doCreatePeerConnection(fromId, rid)
    await pc.setRemoteDescription(new RTCSessionDescription(signal))
    for (const candidate of iceCandidatesRef.current) await pc.addIceCandidate(new RTCIceCandidate(candidate))
    iceCandidatesRef.current = []
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socketRef.current?.emit('call:signal', { roomId: rid, targetId: fromId, signal: answer })
  }

  const doHandleAnswer = async (signal: RTCSessionDescriptionInit) => {
    if (!pcRef.current) return
    await pcRef.current.setRemoteDescription(new RTCSessionDescription(signal))
    for (const candidate of iceCandidatesRef.current) await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
    iceCandidatesRef.current = []
  }

  const doHandleIceCandidate = async (signal: RTCIceCandidateInit) => {
    if (pcRef.current?.remoteDescription) await pcRef.current.addIceCandidate(new RTCIceCandidate(signal))
    else iceCandidatesRef.current.push(signal)
  }

  const doEndCall = () => {
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach((t) => t.stop()); localStreamRef.current = null }
    if (remoteStreamRef.current) { remoteStreamRef.current.getTracks().forEach((t) => t.stop()); remoteStreamRef.current = null }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null }
    if (socketRef.current && roomIdRef.current) {
      socketRef.current.emit('call:end', { roomId: roomIdRef.current, targetId: remoteUserRef.current?.id })
    }
    setIsInCall(false)
    setCallStatus('ringing')
    setRemoteUser(null)
    setRoomId('')
    setMicOn(true)
    setCameraOn(true)
    setScreenOn(false)
    roomIdRef.current = ''
    remoteUserRef.current = null
    iceCandidatesRef.current = []
  }

  const getLocalStream = async (type: 'audio' | 'video') => {
    try {
      const constraints: MediaStreamConstraints = { audio: true, video: type === 'video' ? { width: 640, height: 480, facingMode: 'user' } : false }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      localStreamRef.current = stream
      const localVideo = document.querySelector('#local-video') as HTMLVideoElement
      if (localVideo) localVideo.srcObject = stream
      setMicOn(true)
      setCameraOn(type === 'video')
      return stream
    } catch (err) {
      console.error('Failed to get media:', err)
      toast.error('Could not access camera/microphone')
      return null
    }
  }

  // Connect socket on mount
  useEffect(() => {
    if (!currentUser) return

    const socket = io(SIGNAL_URL, {
      auth: { userId: currentUser.id, userName: currentUser.name, userAvatar: currentUser.avatar || undefined },
      transports: ['websocket', 'polling'],
    })
    socketRef.current = socket

    socket.on('call:incoming', ({ fromId, fromName, fromAvatar, callType: ct, roomId: rid }) => {
      setIncomingCall({
        caller: { id: fromId, name: fromName, avatar: fromAvatar, email: '', role: 'team' as const, status: 'active', createdAt: '', updatedAt: '' },
        callType: ct, roomId: rid,
      })
    })

    socket.on('call:accepted', async ({ fromId, roomId: rid }) => {
      setCallStatus('connected')
      const pc = await doCreatePeerConnection(fromId, rid)
      // Create and send offer
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      socket.emit('call:signal', { roomId: rid, targetId: fromId, signal: offer })
    })

    socket.on('call:rejected', () => { toast.error('Call rejected'); doEndCall() })
    socket.on('call:ended', () => { toast.info('Call ended'); doEndCall() })

    socket.on('call:signal', async ({ fromId, signal }) => {
      if (signal.type === 'offer') await doHandleOffer(fromId, signal, roomIdRef.current)
      else if (signal.type === 'answer') await doHandleAnswer(signal as RTCSessionDescriptionInit)
      else if (signal.candidate) await doHandleIceCandidate(signal as RTCIceCandidateInit)
    })

    return () => { socket.disconnect(); socketRef.current = null }
  }, [currentUser])

  // ── Public Actions ──

  const startCall = useCallback(async (target: User, type: 'audio' | 'video') => {
    if (!currentUser || !socketRef.current?.connected) { toast.error('Not connected to call service'); return }
    setCallType(type)
    setRemoteUser(target)
    remoteUserRef.current = target
    setCallStatus('ringing')
    setIsInCall(true)
    const rid = `${currentUser.id}-${target.id}-${Date.now()}`
    syncState({ roomId: rid, remoteUser: target })
    await getLocalStream(type)
    socketRef.current.emit('call:join', { roomId: rid })
    socketRef.current.emit('call:ring', { targetId: target.id, callType: type, roomId: rid })
    toast.info(`Calling ${target.name}...`)
  }, [currentUser, getLocalStream])

  const acceptCall = useCallback(async () => {
    if (!incomingCall || !currentUser || !socketRef.current) return
    const { caller, callType: ct, roomId: rid } = incomingCall
    setCallType(ct)
    setRemoteUser(caller)
    remoteUserRef.current = caller
    setCallStatus('connecting')
    setIsInCall(true)
    syncState({ roomId: rid, remoteUser: caller })
    setIncomingCall(null)
    await getLocalStream(ct)
    socketRef.current.emit('call:join', { roomId: rid })
    socketRef.current.emit('call:accept', { targetId: caller.id, roomId: rid })
    setCallStatus('connected')
    toast.success('Call connected')
  }, [incomingCall, currentUser, getLocalStream])

  const rejectCall = useCallback(() => {
    if (!incomingCall || !socketRef.current) return
    socketRef.current.emit('call:reject', { targetId: incomingCall.caller.id })
    setIncomingCall(null)
    toast.info('Call rejected')
  }, [incomingCall])

  const endCall = useCallback(() => { doEndCall() }, [])

  const toggleMic = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) { audioTrack.enabled = !audioTrack.enabled; setMicOn(audioTrack.enabled) }
    }
    if (socketRef.current && roomIdRef.current) socketRef.current.emit('call:toggle-mic', { roomId: roomIdRef.current, isOn: !micOn })
  }, [micOn])

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) { videoTrack.enabled = !videoTrack.enabled; setCameraOn(videoTrack.enabled) }
    }
    if (socketRef.current && roomIdRef.current) socketRef.current.emit('call:toggle-camera', { roomId: roomIdRef.current, isOn: !cameraOn })
  }, [cameraOn])

  const toggleScreen = useCallback(async () => {
    if (screenOn) {
      const screenTrack = localStreamRef.current?.getVideoTracks().find((t) => t.label.includes('screen'))
      if (screenTrack) screenTrack.stop()
      if (callType === 'video') {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: 'user' } })
          const camTrack = camStream.getVideoTracks()[0]
          if (camTrack && pcRef.current) { const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video'); if (sender) sender.replaceTrack(camTrack) }
          localStreamRef.current?.addTrack(camTrack)
          const localVideo = document.querySelector('#local-video') as HTMLVideoElement
          if (localVideo) localVideo.srcObject = localStreamRef.current
        } catch { /* Camera not available */ }
      }
      setScreenOn(false)
    } else {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        const screenTrack = screenStream.getVideoTracks()[0]
        if (pcRef.current) { const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video'); if (sender) sender.replaceTrack(screenTrack) }
        screenTrack.onended = () => setScreenOn(false)
        setScreenOn(true)
        toast.success('Screen sharing started')
      } catch { toast.error('Could not share screen') }
    }
    if (socketRef.current && roomIdRef.current) socketRef.current.emit('call:toggle-screen', { roomId: roomIdRef.current, isOn: !screenOn })
  }, [screenOn, callType])

  return { isInCall, callType, callStatus, remoteUser, incomingCall, micOn, cameraOn, screenOn, startCall, acceptCall, rejectCall, endCall, toggleMic, toggleCamera, toggleScreen }
}
