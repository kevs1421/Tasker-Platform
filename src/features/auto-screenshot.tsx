'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'sonner'
import { useAuthStore, authHeaders } from '@/stores/auth'
import { authFetch } from '@/lib/client-fetch'
import type { ScreenshotConfig } from '@/types'
import { cn } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import {
  Tooltip, TooltipContent, TooltipTrigger, TooltipProvider,
} from '@/components/ui/tooltip'
import {
  Camera, Timer, Loader2, Settings2, Check, AlertCircle,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Preset intervals ────────────────────────────────────
const INTERVAL_PRESETS = [
  { value: 1, label: '1 min' },
  { value: 2, label: '2 min' },
  { value: 3, label: '3 min' },
  { value: 5, label: '5 min' },
  { value: 10, label: '10 min' },
  { value: 15, label: '15 min' },
  { value: 30, label: '30 min' },
  { value: 60, label: '60 min' },
]

// ─── Format countdown ────────────────────────────────────
function formatCountdown(seconds: number): string {
  if (seconds <= 0) return 'Capturing...'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Auto Screenshot Hook ────────────────────────────────
export function useAutoScreenshot() {
  const { user } = useAuthStore()
  const [config, setConfig] = useState<ScreenshotConfig | null>(null)
  const [configLoading, setConfigLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const [captureCount, setCaptureCount] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isRunningRef = useRef(false)

  // Fetch config
  const fetchConfig = useCallback(async () => {
    if (!user) return
    try {
      const res = await authFetch(`/api/screenshot-config?userId=${user.id}`)
      if (res.ok) {
        const data = await res.json()
        setConfig(data.config)
      }
    } catch {
      // silent
    } finally {
      setConfigLoading(false)
    }
  }, [user])

  useEffect(() => { fetchConfig() }, [fetchConfig])

  // Save config
  const saveConfig = useCallback(async (updates: Partial<ScreenshotConfig>) => {
    if (!user) return
    setSavingConfig(true)
    try {
      const res = await authFetch('/api/screenshot-config', {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId: user.id, ...updates }),
      })
      if (res.ok) {
        const data = await res.json()
        setConfig(data.config)
        toast.success('Screenshot settings updated')
      }
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSavingConfig(false)
    }
  }, [user])

  // Capture screenshot using getDisplayMedia
  const captureScreenshot = useCallback(async () => {
    if (!user || isCapturing) return
    setIsCapturing(true)

    try {
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: false,
      })

      // Get the video track
      const track = stream.getVideoTracks()[0]
      const imageCapture = new ImageCapture(track) as unknown as { grabFrame(): Promise<ImageBitmap> }
      const bitmap = await imageCapture.grabFrame()

      // Stop the stream immediately
      stream.getTracks().forEach(t => t.stop())

      // Convert bitmap to blob
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')
      ctx.drawImage(bitmap, 0, 0)
      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.error('Failed to create screenshot')
          setIsCapturing(false)
          return
        }

        // Upload to server
        const formData = new FormData()
        const now = new Date()
        const timestamp = now.toLocaleString('en-US', {
          month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true,
        })
        formData.append('file', blob, `auto-${now.toISOString().replace(/[:.]/g, '-')}.png`)
        formData.append('userId', user.id)
        formData.append('userRole', user.role)
        formData.append('title', `Auto Screenshot - ${timestamp}`)
        formData.append('description', 'Automatically captured during time tracking')
        formData.append('isAuto', 'true')

        try {
          const res = await authFetch('/api/screenshots', { method: 'POST', body: formData })
          if (res.ok) {
            setCaptureCount(prev => prev + 1)
            toast.success('Auto screenshot captured', { duration: 2000 })
          } else {
            toast.error('Failed to upload screenshot')
          }
        } catch {
          toast.error('Failed to upload screenshot')
        } finally {
          setIsCapturing(false)
        }
      }, 'image/png')
    } catch (err) {
      // User may have denied permission or cancelled
      if (err instanceof Error && (err.name === 'NotAllowedError' || err.message.includes('Permission'))) {
        toast.error('Screen capture permission denied')
      }
      setIsCapturing(false)
      // If auto mode and user denied, disable auto capture
      if (isRunningRef.current) {
        stopAutoCapture()
        if (config) saveConfig({ ...config, autoEnabled: false })
      }
    }
  }, [user, isCapturing, config, saveConfig])

  // Start auto capture
  const startAutoCapture = useCallback((intervalMinutes: number) => {
    if (isRunningRef.current) return
    isRunningRef.current = true
    setIsRunning(true)
    setCountdown(intervalMinutes * 60)
    setCaptureCount(0)

    // Countdown timer (every second)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 0) return intervalMinutes * 60 // reset when reaching 0
        return prev - 1
      })
    }, 1000)

    // Screenshot interval
    intervalRef.current = setInterval(() => {
      captureScreenshot()
      setCountdown(intervalMinutes * 60) // reset countdown
    }, intervalMinutes * 60 * 1000)

    // Take first screenshot immediately
    captureScreenshot()
  }, [captureScreenshot])

  // Stop auto capture
  const stopAutoCapture = useCallback(() => {
    isRunningRef.current = false
    setIsRunning(false)
    setCountdown(0)
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    intervalRef.current = null
    countdownRef.current = null
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  return {
    config,
    configLoading,
    savingConfig,
    isCapturing,
    isRunning,
    countdown,
    captureCount,
    saveConfig,
    startAutoCapture,
    stopAutoCapture,
    captureScreenshot,
  }
}

// ─── Auto Screenshot Settings Panel ──────────────────────
interface AutoScreenshotPanelProps {
  isTimerActive: boolean
  autoHook: ReturnType<typeof useAutoScreenshot>
  onToggle?: (enabled: boolean) => void
}

export function AutoScreenshotPanel({ isTimerActive, autoHook, onToggle }: AutoScreenshotPanelProps) {
  const {
    config,
    configLoading,
    savingConfig,
    isCapturing,
    isRunning,
    countdown,
    captureCount,
    saveConfig,
    startAutoCapture,
    stopAutoCapture,
    captureScreenshot,
  } = autoHook

  const handleToggle = async (enabled: boolean) => {
    if (!config || !isTimerActive) return
    await saveConfig({ ...config, autoEnabled: enabled })
    if (enabled) {
      startAutoCapture(config.intervalMinutes)
    } else {
      stopAutoCapture()
    }
    onToggle?.(enabled)
  }

  const handleIntervalChange = async (minutes: number) => {
    if (!config) return
    await saveConfig({ ...config, intervalMinutes: minutes })
    // If currently running, restart with new interval
    if (isRunning) {
      stopAutoCapture()
      startAutoCapture(minutes)
    }
  }

  if (configLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      </Card>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 }}
    >
      <Card className="p-4 overflow-hidden relative">
        {/* Animated border when active */}
        {isRunning && (
          <div className="absolute inset-0 rounded-lg border-2 border-emerald-400/50 pointer-events-none animate-pulse" />
        )}

        <div className="flex flex-col gap-4">
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg shrink-0 transition-colors',
                isRunning
                  ? 'bg-emerald-100 dark:bg-emerald-900/30'
                  : 'bg-slate-100 dark:bg-slate-800'
              )}>
                <Camera className={cn(
                  'h-5 w-5 transition-colors',
                  isRunning ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'
                )} />
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Auto Screenshot
                  {isRunning && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Recording
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isTimerActive
                    ? 'Automatically capture screenshots while tracking time'
                    : 'Start the timer first to enable auto screenshots'
                  }
                </p>
              </div>
            </div>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Switch
                      checked={isRunning}
                      onCheckedChange={handleToggle}
                      disabled={!isTimerActive || savingConfig}
                      className="data-[state=checked]:bg-emerald-600"
                    />
                  </div>
                </TooltipTrigger>
                {!isTimerActive && (
                  <TooltipContent>
                    <p>Start the timer first</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </div>

          {/* Settings Body (expandable) */}
          <AnimatePresence>
            {(config?.autoEnabled || isRunning) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="pt-3 border-t border-border/50 space-y-3">
                  {/* Interval Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Timer className="h-3.5 w-3.5" />
                      Capture Interval
                    </Label>
                    <div className="flex flex-wrap gap-1.5">
                      {INTERVAL_PRESETS.map((preset) => (
                        <Button
                          key={preset.value}
                          variant={config?.intervalMinutes === preset.value ? 'default' : 'outline'}
                          size="sm"
                          className={cn(
                            'h-7 px-2.5 text-xs',
                            config?.intervalMinutes === preset.value && 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          )}
                          onClick={() => handleIntervalChange(preset.value)}
                          disabled={savingConfig}
                        >
                          {preset.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Custom Interval Input */}
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Custom:</Label>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={config?.intervalMinutes ?? 5}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10)
                          if (val >= 1 && val <= 60) handleIntervalChange(val)
                        }}
                        className="h-7 w-16 rounded-md border border-input bg-transparent px-2 text-xs text-center focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        disabled={savingConfig}
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  </div>

                  {/* Status Info */}
                  <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
                    {isRunning && (
                      <>
                        <div className="flex items-center gap-1.5">
                          <Timer className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Next capture: <span className="font-mono font-medium text-foreground">{formatCountdown(countdown)}</span></span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Camera className="h-3.5 w-3.5 text-emerald-500" />
                          <span>Captured: <span className="font-medium text-foreground">{captureCount}</span></span>
                        </div>
                      </>
                    )}
                    {isCapturing && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Capturing screen...</span>
                      </div>
                    )}
                  </div>

                  {/* Manual Capture Button */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1.5"
                      onClick={captureScreenshot}
                      disabled={isCapturing || !isTimerActive}
                    >
                      {isCapturing ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                      Capture Now
                    </Button>
                    {isRunning && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                        onClick={() => {
                          stopAutoCapture()
                          if (config) saveConfig({ ...config, autoEnabled: false })
                          onToggle?.(false)
                        }}
                      >
                        <AlertCircle className="h-3.5 w-3.5" />
                        Stop Auto
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>
    </motion.div>
  )
}