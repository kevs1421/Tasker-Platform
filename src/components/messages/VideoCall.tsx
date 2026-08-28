'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  MonitorUp, MonitorOff, Copy, Maximize2, Minimize2,
  CallEnd, X, UserPlus, MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { getInitials } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import type { User } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────

export interface VideoCallState {
  isInCall: boolean
  callType: 'audio' | 'video'
  remoteUser: User | null
  callStatus: 'ringing' | 'connected' | 'connecting'
}

interface VideoCallProps {
  currentUser: User
  targetUser: User | null
  isInCall: boolean
  callType: 'audio' | 'video'
  callStatus: 'ringing' | 'connected' | 'connecting'
  onJoinVideo: () => void
  onJoinAudio: () => void
  onEnd: () => void
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleScreen: () => void
  micOn: boolean
  cameraOn: boolean
  screenOn: boolean
}

// ─── Incoming Call Overlay ──────────────────────────────────────────────

export function IncomingCallOverlay({
  caller,
 callType,
  onAccept,
  onReject,
}: {
  caller: User
  callType: 'audio' | 'video'
  onAccept: () => void
  onReject: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <div className="bg-card rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center border">
        <div className="mb-6">
          <Avatar className="h-20 w-20 mx-auto mb-4">
            {caller.avatar && <AvatarImage src={caller.avatar} />}
            <AvatarFallback className="bg-slate-200 dark:bg-slate-700 text-2xl font-semibold">
              {getInitials(caller.name)}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-semibold text-foreground">{caller.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {callType === 'video' ? 'Incoming video call...' : 'Incoming audio call...'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={onReject}
            className="h-14 w-14 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
          <button
            onClick={onAccept}
            className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors shadow-lg animate-pulse"
          >
            <Phone className="h-6 w-6" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Active Call Floating Panel ─────────────────────────────────────────

export function VideoCallPanel({
  currentUser,
  targetUser,
  isInCall,
  callType,
  callStatus,
  onEnd,
  onToggleMic,
  onToggleCamera,
  onToggleScreen,
  micOn,
  cameraOn,
  screenOn,
}: VideoCallProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [meetingLink, setMeetingLink] = useState('')
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const timerRef = useRef<ReturnType<typeof setInterval>>

  // Timer for connected calls
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      setCallDuration(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [callStatus])

  // Generate meeting link
  useEffect(() => {
    if (isInCall) {
      const id = Math.random().toString(36).substring(2, 10)
      setMeetingLink(`${window.location.origin}/meet/${id}`)
    }
  }, [isInCall])

  const copyLink = useCallback(() => {
    if (meetingLink) {
      navigator.clipboard.writeText(meetingLink)
      toast.success('Meeting link copied!')
    }
  }, [meetingLink])

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return h > 0
      ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
      : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  if (!isInCall) return null

  // ── Minimized view ──
  if (isMinimized) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.9 }}
          className="fixed bottom-6 right-6 z-50"
        >
          <div className="flex items-center gap-2 bg-card border rounded-2xl shadow-2xl px-3 py-2.5 pr-1.5">
            {targetUser && (
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  'h-2.5 w-2.5 rounded-full flex-shrink-0',
                  callStatus === 'connected' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
                )} />
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {targetUser.name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {callStatus === 'connected' ? formatTime(callDuration) : callStatus === 'ringing' ? 'Ringing...' : 'Connecting...'}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 flex-shrink-0"
              onClick={() => setIsMinimized(false)}
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 flex-shrink-0"
              onClick={onEnd}
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // ── Full call panel ──
  const isConnected = callStatus === 'connected'
  const isRinging = callStatus === 'ringing'
  const isConnecting = callStatus === 'connecting'
  const isVideoCall = callType === 'video'

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed bottom-6 right-6 z-50"
      >
        <div className={cn(
          'rounded-2xl shadow-2xl border overflow-hidden',
          isVideoCall ? 'w-[520px] h-[400px]' : 'w-[380px] h-[280px]',
          'bg-slate-950 text-white'
        )}>
          {/* ── Call Header ── */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-slate-900/80 border-b border-white/10">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn(
                'h-2.5 w-2.5 rounded-full flex-shrink-0',
                isConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              )} />
              <span className="text-sm font-medium text-white/90 truncate">
                {targetUser ? targetUser.name : 'Meeting'}
              </span>
              <span className="text-xs text-white/50 font-mono">
                {isConnected
                  ? formatTime(callDuration)
                  : isRinging
                    ? 'Ringing...'
                    : 'Connecting...'}
              </span>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
                onClick={copyLink}
                title="Copy meeting link"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
                onClick={() => setIsMinimized(true)}
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* ── Video Area ── */}
          <div className="relative flex-1" style={{ height: isVideoCall ? 'calc(100% - 110px)' : 'calc(100% - 110px)' }}>
            {/* Remote / Main Video */}
            <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
              {isVideoCall ? (
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                  style={{ display: isConnected ? 'block' : 'none' }}
                />
              ) : null}
              {!isConnected && (
                <div className="flex flex-col items-center gap-3">
                  <Avatar className="h-20 w-20">
                    {targetUser?.avatar && <AvatarImage src={targetUser.avatar} />}
                    <AvatarFallback className="bg-slate-700 text-2xl font-semibold">
                      {targetUser ? getInitials(targetUser.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="text-center">
                    <p className="text-white/90 font-medium">
                      {isRinging ? 'Calling...' : 'Connecting...'}
                    </p>
                    {isRinging && (
                      <div className="flex items-center justify-center gap-1.5 mt-2">
                        {[0, 1, 2].map((i) => (
                          <motion.div
                            key={i}
                            className="h-2 w-2 bg-emerald-400 rounded-full"
                            animate={{ opacity: [0.3, 1, 0.3] }}
                            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              {isConnected && isVideoCall && !screenOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <Avatar className="h-24 w-24">
                    {targetUser?.avatar && <AvatarImage src={targetUser.avatar} />}
                    <AvatarFallback className="bg-slate-700 text-3xl font-semibold">
                      {targetUser ? getInitials(targetUser.name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                </div>
              )}
              {isConnected && !isVideoCall && (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Phone className="h-10 w-10 text-emerald-400" />
                  </div>
                  <p className="text-white/70 text-sm">Audio call in progress</p>
                  <p className="text-white/50 text-lg font-mono font-medium">
                    {formatTime(callDuration)}
                  </p>
                </div>
              )}
            </div>

            {/* Screen share overlay */}
            {screenOn && isConnected && (
              <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                <p className="text-white/60 text-sm">Screen sharing active</p>
              </div>
            )}

            {/* Local video (picture-in-picture) */}
            {isVideoCall && (
              <div className={cn(
                'absolute bottom-3 right-3 rounded-xl overflow-hidden shadow-lg border-2 border-white/20',
                cameraOn ? 'w-[140px] h-[105px]' : 'w-[100px] h-[100px]'
              )}>
                {cameraOn ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                    <Avatar className="h-10 w-10">
                      {currentUser?.avatar && <AvatarImage src={currentUser.avatar} />}
                      <AvatarFallback className="bg-slate-700 text-sm font-semibold">
                        {getInitials(currentUser.name)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Controls Bar ── */}
          <div className="absolute bottom-0 left-0 right-0 px-4 py-3">
            <div className="flex items-center justify-center gap-2">
              {/* Mic */}
              <button
                onClick={onToggleMic}
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center transition-all',
                  micOn
                    ? 'bg-white/15 hover:bg-white/25 text-white'
                    : 'bg-red-500 hover:bg-red-600 text-white'
                )}
                title={micOn ? 'Mute' : 'Unmute'}
              >
                {micOn ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              </button>

              {/* Camera (video calls only) */}
              {isVideoCall && (
                <button
                  onClick={onToggleCamera}
                  className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center transition-all',
                    cameraOn
                      ? 'bg-white/15 hover:bg-white/25 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  )}
                  title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
                >
                  {cameraOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                </button>
              )}

              {/* Screen share */}
              <button
                onClick={onToggleScreen}
                className={cn(
                  'h-10 w-10 rounded-full flex items-center justify-center transition-all',
                  screenOn
                    ? 'bg-emerald-500 hover:bg-emerald-600 text-white'
                    : 'bg-white/15 hover:bg-white/25 text-white'
                )}
                title={screenOn ? 'Stop sharing' : 'Share screen'}
              >
                {screenOn ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
              </button>

              {/* End Call */}
              <button
                onClick={onEnd}
                className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg"
                title="End call"
              >
                <PhoneOff className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ── Video Call Button (for chat header) ──

export function VideoCallButtons({
  onVideo,
  onAudio,
  disabled,
}: {
  onVideo: () => void
  onAudio: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1 ml-auto mr-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
        onClick={onAudio}
        disabled={disabled}
        title="Audio call"
      >
        <Phone className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
        onClick={onVideo}
        disabled={disabled}
        title="Video call"
      >
        <Video className="h-4 w-4" />
      </Button>
    </div>
  )
}
