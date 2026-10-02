'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  Phone, PhoneOff, Mic, MicOff, Video, VideoOff,
  MonitorUp, MonitorOff, Copy, Maximize2, Minimize2,
  Users, Monitor, ImageIcon, Upload, X, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { getInitials } from '@/features/route-guard'
import { cn } from '@/lib/utils'
import {
  useVirtualBackground,
  type VirtualBackgroundOption,
} from '@/hooks/use-virtual-background'
import type { User } from '@/types'

// ─── Types ──────────────────────────────────────────────────────────────

interface VideoCallProps {
  currentUser: User
  targetUser: User | null
  isInCall: boolean
  callType: 'audio' | 'video'
  callStatus: 'ringing' | 'connected' | 'connecting'
  onEnd: () => void
  onToggleMic: () => void
  onToggleCamera: () => void
  onToggleScreen: () => void
  onApplyVirtualBg: (stream: MediaStream) => Promise<void>
  onRemoveVirtualBg: () => Promise<void>
  micOn: boolean
  cameraOn: boolean
  screenOn: boolean
  remoteScreenOn: boolean
  remoteMicOn: boolean
  remoteCameraOn: boolean
  screenShareLabel: string
  localStream: MediaStream | null
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
            className="h-14 w-14 rounded-full bg-emerald-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg animate-pulse"
          >
            <Phone className="h-6 w-6" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Screen Share Banner ───────────────────────────────────────────────

function ScreenShareBanner({
  isLocal,
  label,
  onStop,
}: {
  isLocal: boolean
  label: string
  onStop: () => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex items-center justify-between px-4 py-2 bg-emerald-600 text-white text-sm"
    >
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
        <Monitor className="h-4 w-4" />
        <span className="font-medium">
          {isLocal ? 'You are sharing your screen' : `${label} is presenting`}
        </span>
        {label && isLocal && (
          <span className="text-white/70 text-xs truncate max-w-[200px]">— {label}</span>
        )}
      </div>
      {isLocal && (
        <button
          onClick={onStop}
          className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md text-sm font-medium transition-colors"
        >
          <MonitorOff className="h-3.5 w-3.5" />
          Stop
        </button>
      )}
    </motion.div>
  )
}

// ─── Virtual Background Panel ──────────────────────────────────────────

function VirtualBackgroundPanel({
  isOpen,
  onClose,
  localStream,
  onApplyVirtualBg,
  onRemoveVirtualBg,
}: {
  isOpen: boolean
  onClose: () => void
  localStream: MediaStream | null
  onApplyVirtualBg: (stream: MediaStream) => Promise<void>
  onRemoveVirtualBg: () => Promise<void>
}) {
  const {
    selected,
    isActive,
    isLoading,
    allBackgrounds,
    startProcessing,
    stopProcessing,
    switchBackground,
    uploadCustomBackground,
  } = useVirtualBackground()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [applying, setApplying] = useState(false)

  // When user selects a background
  const handleSelect = useCallback(async (option: VirtualBackgroundOption) => {
    await switchBackground(option)

    if (option.type === 'none') {
      // Remove virtual background
      stopProcessing()
      await onRemoveVirtualBg()
      return
    }

    if (!localStream) return

    setApplying(true)
    try {
      // Stop any existing processing first
      stopProcessing()

      // Start processing with the raw camera stream
      const processedStream = await startProcessing(localStream)
      if (processedStream) {
        await onApplyVirtualBg(processedStream)

        // Also show the processed stream in the local preview
        requestAnimationFrame(() => {
          const localVideo = document.querySelector('#local-video') as HTMLVideoElement
          if (localVideo) localVideo.srcObject = processedStream
        })
      } else {
        toast.error('Failed to apply virtual background')
      }
    } catch (err) {
      toast.error('Failed to apply virtual background')
    } finally {
      setApplying(false)
    }
  }, [switchBackground, localStream, startProcessing, stopProcessing, onApplyVirtualBg, onRemoveVirtualBg])

  // Upload custom background
  const handleUpload = useCallback(async () => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const option = await uploadCustomBackground(file)
    if (option) {
      await handleSelect(option)
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [uploadCustomBackground, handleSelect])

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 w-[340px] bg-slate-900 border border-white/15 rounded-2xl shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-400" />
          <span className="text-sm font-medium text-white">Virtual Background</span>
        </div>
        <button
          onClick={onClose}
          className="h-6 w-6 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Loading bar */}
      {isLoading && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-violet-300">
            <div className="h-2 w-2 rounded-full bg-violet-400 animate-pulse" />
            <span>Loading AI segmentation model...</span>
          </div>
          <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-violet-500 rounded-full"
              animate={{ x: ['0%', '100%', '0%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '40%' }}
            />
          </div>
        </div>
      )}

      {/* Applying bar */}
      {applying && (
        <div className="px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-emerald-300">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Applying virtual background...</span>
          </div>
        </div>
      )}

      {/* Background options grid */}
      <div className="p-3 grid grid-cols-4 gap-2 max-h-[240px] overflow-y-auto">
        {allBackgrounds.map((bg) => (
          <button
            key={bg.id}
            onClick={() => handleSelect(bg)}
            className={cn(
              'relative group flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all',
              selected.id === bg.id
                ? 'bg-violet-500/30 ring-2 ring-violet-400'
                : 'hover:bg-white/10',
              (isLoading || applying) && 'opacity-50 pointer-events-none'
            )}
            disabled={isLoading || applying}
          >
            {/* Thumbnail */}
            <div className={cn(
              'w-full aspect-video rounded-lg overflow-hidden border',
              selected.id === bg.id ? 'border-violet-400' : 'border-white/10'
            )}>
              {bg.type === 'none' ? (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <X className="h-4 w-4 text-white/40" />
                </div>
              ) : bg.type === 'blur' ? (
                <div className="w-full h-full bg-gradient-to-br from-slate-600 to-slate-800 flex items-center justify-center backdrop-blur-lg">
                  <div className="h-4 w-4 rounded-full bg-slate-400/60 blur-[2px]" />
                </div>
              ) : bg.thumbnail ? (
                <img
                  src={bg.thumbnail}
                  alt={bg.label}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-700 flex items-center justify-center">
                  <ImageIcon className="h-3 w-3 text-white/40" />
                </div>
              )}
            </div>
            {/* Label */}
            <span className={cn(
              'text-[10px] leading-tight truncate w-full text-center',
              selected.id === bg.id ? 'text-violet-300 font-medium' : 'text-white/60'
            )}>
              {bg.label}
            </span>
            {/* Active indicator */}
            {selected.id === bg.id && isActive && bg.type !== 'none' && (
              <div className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
        ))}

        {/* Upload button */}
        <button
          onClick={handleUpload}
          className={cn(
            'relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl transition-all',
            'hover:bg-white/10 border border-dashed border-white/15',
            (isLoading || applying) && 'opacity-50 pointer-events-none'
          )}
          disabled={isLoading || applying}
        >
          <div className="w-full aspect-video rounded-lg bg-white/5 flex items-center justify-center">
            <Upload className="h-4 w-4 text-white/40" />
          </div>
          <span className="text-[10px] leading-tight text-white/50">Upload</span>
        </button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Current status */}
      {isActive && selected.type !== 'none' && (
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2 text-xs text-emerald-300">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Virtual background active</span>
          {selected.type === 'blur' && <span className="text-white/40">— Blur</span>}
          {selected.type === 'image' && <span className="text-white/40">— {selected.label}</span>}
        </div>
      )}
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
  onApplyVirtualBg,
  onRemoveVirtualBg,
  micOn,
  cameraOn,
  screenOn,
  remoteScreenOn,
  remoteMicOn,
  remoteCameraOn,
  screenShareLabel,
  localStream,
}: VideoCallProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [meetingLink, setMeetingLink] = useState('')
  const [remoteVideoPresent, setRemoteVideoPresent] = useState(false)
  const [remoteScreenPresent, setRemoteScreenPresent] = useState(false)
  const [showBgPanel, setShowBgPanel] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Timer for connected calls
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => setCallDuration((p) => p + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      queueMicrotask(() => setCallDuration(0))
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [callStatus])

  // Generate meeting link
  useEffect(() => {
    if (isInCall) {
      const id = Math.random().toString(36).substring(2, 10)
      // Use microtask to avoid synchronous setState in effect
      queueMicrotask(() => setMeetingLink(`${window.location.origin}/meet/${id}`))
    }
  }, [isInCall])

  // Monitor remote video tracks
  useEffect(() => {
    if (callStatus !== 'connected') {
      queueMicrotask(() => {
        setRemoteVideoPresent(false)
        setRemoteScreenPresent(false)
      })
      return
    }
    const checkTracks = setInterval(() => {
      const remoteVideo = document.querySelector('#remote-video') as HTMLVideoElement
      const hasVideo = remoteVideo?.srcObject instanceof MediaStream &&
        (remoteVideo.srcObject as MediaStream).getVideoTracks().some((t) => t.enabled && t.readyState === 'live')
      setRemoteVideoPresent(!!hasVideo)

      const remoteScreenVideo = document.querySelector('#remote-screen-video') as HTMLVideoElement
      const hasScreen = remoteScreenVideo?.srcObject instanceof MediaStream &&
        (remoteScreenVideo.srcObject as MediaStream).getVideoTracks().length > 0
      setRemoteScreenPresent(!!hasScreen)
    }, 1000)
    return () => clearInterval(checkTracks)
  }, [callStatus])

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

  const toggleFullscreen = useCallback(() => {
    if (!panelRef.current) return
    if (!document.fullscreenElement) {
      panelRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {})
    }
  }, [])

  if (!isInCall) return null

  const isConnected = callStatus === 'connected'
  const isRinging = callStatus === 'ringing'
  const isConnecting = callStatus === 'connecting'
  const isVideoCall = callType === 'video'
  const isGroupCall = targetUser?.role === 'team' && targetUser?.id?.startsWith('group-')

  // Whether the main view should show screen content
  const showLocalScreen = isConnected && screenOn
  const showRemoteScreen = isConnected && remoteScreenOn && remoteScreenPresent
  const showScreenContent = showLocalScreen || showRemoteScreen

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
                  isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'
                )} />
                {showScreenContent && <MonitorUp className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />}
                <span className="text-sm font-medium truncate max-w-[120px]">
                  {targetUser.name}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {isConnected ? formatTime(callDuration) : isRinging ? 'Ringing...' : 'Connecting...'}
                </span>
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => setIsMinimized(false)}>
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
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
  return (
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className={cn(
          'fixed z-50 shadow-2xl border-2 border-slate-700 overflow-hidden',
          showScreenContent
            ? 'bottom-4 right-4 left-4 top-4'
            : 'bottom-6 right-6',
          showScreenContent
            ? 'w-auto h-auto'
            : isVideoCall ? 'w-[560px] h-[420px]' : 'w-[380px] h-[280px]',
          'rounded-2xl bg-slate-950 text-white',
          isFullscreen && 'fixed inset-0 !rounded-none !border-0'
        )}
      >
        {/* ── Screen Share Banner ── */}
        <AnimatePresence>
          {showLocalScreen && (
            <ScreenShareBanner
              isLocal
              label={screenShareLabel}
              onStop={onToggleScreen}
            />
          )}
          {showRemoteScreen && !showLocalScreen && (
            <ScreenShareBanner
              isLocal={false}
              label={targetUser?.name ?? 'Participant'}
              onStop={() => {}}
            />
          )}
        </AnimatePresence>

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
            {isGroupCall && <Users className="h-3.5 w-3.5 text-white/50" />}
            <span className="text-xs text-white/50 font-mono">
              {isConnected ? formatTime(callDuration) : isRinging ? 'Ringing...' : 'Connecting...'}
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
              onClick={copyLink}
              title="Copy meeting link"
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-white/60 hover:text-white hover:bg-white/10"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ── Video Area ── */}
        <div className="relative" style={{ height: 'calc(100% - 110px - 40px)' }}>
          {/* ── SCREEN SHARE MAIN VIEW ── */}
          {showScreenContent ? (
            <div className="absolute inset-0 bg-slate-900">
              {/* Local screen share (presenting) */}
              {showLocalScreen && (
                <div className="absolute inset-0 flex flex-col">
                  <div className="flex-1 flex items-center justify-center p-4">
                    <div className="relative w-full h-full bg-slate-800 rounded-lg overflow-hidden shadow-2xl border border-white/10">
                      <video
                        id="local-screen-video"
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-contain bg-black"
                      />
                      {/* Stop button overlay */}
                      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                        <button
                          onClick={onToggleScreen}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-medium transition-colors shadow-lg"
                        >
                          <MonitorOff className="h-4 w-4" />
                          Stop sharing
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Remote screen share (viewing) */}
              {showRemoteScreen && !showLocalScreen && (
                <div className="absolute inset-0 bg-black flex items-center justify-center p-4">
                  <div className="relative w-full h-full rounded-lg overflow-hidden">
                    <video
                      id="remote-screen-video"
                      autoPlay
                      playsInline
                      className="w-full h-full object-contain bg-black"
                    />
                    {/* Remote user info when viewing screen */}
                    <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-sm rounded-lg">
                      <Avatar className="h-6 w-6">
                        {targetUser?.avatar && <AvatarImage src={targetUser.avatar} />}
                        <AvatarFallback className="bg-slate-600 text-[10px]">
                          {targetUser ? getInitials(targetUser.name) : '?'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-white/80 font-medium">{targetUser?.name ?? 'Participant'}</span>
                      {!remoteCameraOn && <VideoOff className="h-3 w-3 text-white/50" />}
                    </div>
                  </div>
                </div>
              )}

              {/* Picture-in-picture: local camera when presenting screen */}
              {isVideoCall && showLocalScreen && (
                <div className="absolute bottom-20 right-4 w-[160px] h-[120px] rounded-xl overflow-hidden shadow-xl border-2 border-white/20 bg-slate-800">
                  {cameraOn ? (
                    <video
                      id="local-video"
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover transform -scale-x-100"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
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
          ) : (
            /* ── NORMAL VIDEO / AUDIO VIEW ── */
            <div className="absolute inset-0 bg-slate-900 flex items-center justify-center">
              {/* Remote video */}
              {isVideoCall && isConnected && (
                <video
                  id="remote-video"
                  autoPlay
                  playsInline
                  className={cn(
                    'w-full h-full object-cover',
                    !remoteVideoPresent && 'hidden'
                  )}
                />
              )}

              {/* Waiting/connecting state */}
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

              {/* Remote user avatar (camera off or no video) */}
              {isConnected && isVideoCall && !remoteVideoPresent && !showScreenContent && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                  <div className="flex flex-col items-center gap-2">
                    <Avatar className="h-24 w-24">
                      {targetUser?.avatar && <AvatarImage src={targetUser.avatar} />}
                      <AvatarFallback className="bg-slate-700 text-3xl font-semibold">
                        {targetUser ? getInitials(targetUser.name) : '?'}
                      </AvatarFallback>
                    </Avatar>
                    {!remoteCameraOn && (
                      <div className="flex items-center gap-1 text-white/40 text-xs">
                        <VideoOff className="h-3 w-3" />
                        <span>Camera off</span>
                      </div>
                    )}
                    {!remoteMicOn && (
                      <div className="flex items-center gap-1 text-red-400 text-xs">
                        <MicOff className="h-3 w-3" />
                        <span>Muted</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Audio call in progress */}
              {isConnected && !isVideoCall && (
                <div className="flex flex-col items-center gap-3">
                  <div className="h-24 w-24 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Phone className="h-10 w-10 text-emerald-400" />
                  </div>
                  <p className="text-white/70 text-sm">Audio call in progress</p>
                  <p className="text-white/50 text-lg font-mono font-medium">
                    {formatTime(callDuration)}
                  </p>
                  {!remoteMicOn && (
                    <div className="flex items-center gap-1 text-red-400 text-xs">
                      <MicOff className="h-3 w-3" />
                      <span>{targetUser?.name} is muted</span>
                    </div>
                  )}
                </div>
              )}

              {/* Local video picture-in-picture */}
              {isVideoCall && (
                <div className={cn(
                  'absolute bottom-3 right-3 rounded-xl overflow-hidden shadow-lg border-2 border-white/20',
                  cameraOn ? 'w-[140px] h-[105px]' : 'w-[100px] h-[100px]'
                )}>
                  {cameraOn ? (
                    <video
                      id="local-video"
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
          )}
        </div>

        {/* ── Controls Bar ── */}
        <div className={cn(
          'absolute bottom-0 left-0 right-0 px-4 py-3',
          'bg-gradient-to-t from-slate-950/90 to-transparent'
        )}>
          <div className="flex items-center justify-center gap-2">
            {/* Mic */}
            <ControlButton
              active={micOn}
              activeIcon={<Mic className="h-4 w-4" />}
              inactiveIcon={<MicOff className="h-4 w-4" />}
              onClick={onToggleMic}
              title={micOn ? 'Mute' : 'Unmute'}
            />

            {/* Camera (video calls only) */}
            {isVideoCall && (
              <ControlButton
                active={cameraOn}
                activeIcon={<Video className="h-4 w-4" />}
                inactiveIcon={<VideoOff className="h-4 w-4" />}
                onClick={onToggleCamera}
                title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
              />
            )}

            {/* Screen share */}
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="relative group">
                    <ControlButton
                      active={screenOn}
                      activeIcon={<MonitorOff className="h-4 w-4" />}
                      inactiveIcon={<MonitorUp className="h-4 w-4" />}
                      onClick={onToggleScreen}
                      title={screenOn ? 'Stop sharing' : 'Share screen'}
                    />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {screenOn ? 'Stop sharing' : 'Share screen'}
                  {screenOn && screenShareLabel && ` — ${screenShareLabel}`}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Virtual Background (video calls only) */}
            {isVideoCall && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setShowBgPanel((p) => !p)}
                      className={cn(
                        'h-10 w-10 rounded-full flex items-center justify-center transition-all',
                        showBgPanel
                          ? 'bg-violet-500/30 ring-2 ring-violet-400 text-violet-300'
                          : 'bg-white/15 hover:bg-white/25 text-white'
                      )}
                      title="Virtual background"
                    >
                      <Sparkles className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    Virtual background
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* End Call */}
            <button
              onClick={onEnd}
              className="h-10 w-10 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center transition-colors shadow-lg"
              title="End call"
            >
              <PhoneOff className="h-4 w-4" />
            </button>
          </div>

          {/* Screen share indicator at the bottom */}
          {screenOn && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center justify-center gap-2 mt-2 text-xs text-emerald-400"
            >
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>You are presenting</span>
              {screenShareLabel && <span className="text-white/40">({screenShareLabel})</span>}
            </motion.div>
          )}
        </div>

        {/* ── Virtual Background Panel ── */}
        <AnimatePresence>
          {showBgPanel && (
            <VirtualBackgroundPanel
              isOpen={showBgPanel}
              onClose={() => setShowBgPanel(false)}
              localStream={localStream}
              onApplyVirtualBg={onApplyVirtualBg}
              onRemoveVirtualBg={onRemoveVirtualBg}
            />
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Reusable Control Button ───────────────────────────────────────────

function ControlButton({
  active,
  activeIcon,
  inactiveIcon,
  onClick,
  title,
}: {
  active: boolean
  activeIcon: React.ReactNode
  inactiveIcon: React.ReactNode
  onClick: () => void
  title: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'h-10 w-10 rounded-full flex items-center justify-center transition-all',
        active ? 'bg-white/15 hover:bg-white/25 text-white' : 'bg-red-500 hover:bg-red-600 text-white'
      )}
      title={title}
    >
      {active ? activeIcon : inactiveIcon}
    </button>
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

// ── Group Call Buttons ──

export function GroupCallButtons({
  onVideo,
  onAudio,
  disabled,
}: {
  onVideo: () => void
  onAudio: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
        onClick={onAudio}
        disabled={disabled}
        title="Start audio call"
      >
        <Phone className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-emerald-600"
        onClick={onVideo}
        disabled={disabled}
        title="Start video call"
      >
        <Video className="h-4 w-4" />
      </Button>
    </div>
  )
}
