/**
 * Client-side screenshot capture utility using html2canvas-pro
 * Provides the ScreenshotSessionManager class for periodic capture during active sessions
 */
import html2canvas from 'html2canvas-pro'
import { authFetch } from '@/lib/client-fetch'

/**
 * Create a screenshot session manager
 * Handles periodic screenshot capture during active time-in sessions
 */
class ScreenshotSessionManager {
  private intervalId: ReturnType<typeof setInterval> | null = null
  private captureCount = 0
  private isRunning = false
  private lastCaptureTime = 0

  // Config
  private projectId = ''
  private taskId = ''
  private intervalMs = 5 * 60 * 1000 // default 5 min
  private quality = 0.6

  // Callbacks
  private onCaptureStart?: () => void
  private onCaptureComplete?: (count: number) => void
  private onCaptureError?: (error: string) => void

  /**
 * Start the periodic screenshot session
  */
  start(options: {
    projectId?: string
    taskId?: string
    intervalMinutes: number
    quality?: number
    onCaptureStart?: () => void
    onCaptureComplete?: (count: number) => void
    onCaptureError?: (error: string) => void
  }) {
    // Don't start if already running
    if (this.isRunning) this.stop()

    this.projectId = options.projectId || ''
    this.taskId = options.taskId || ''
    this.intervalMs = Math.max(1 * 60 * 1000, (options.intervalMinutes || 5) * 60 * 1000)
    this.quality = options.quality || 0.6
    this.onCaptureStart = options.onCaptureStart
    this.onCaptureComplete = options.onCaptureComplete
    this.onCaptureError = options.onCaptureError
    this.captureCount = 0
    this.isRunning = true

    // Capture first screenshot immediately
    this.capture()

    // Set up interval for subsequent captures
    this.intervalId = setInterval(() => {
      this.capture()
    }, this.intervalMs)
  }

  /**
 * Stop the screenshot session
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
  }

  /**
 * Update interval (e.g. if admin changes settings mid-session)
   */
  updateInterval(intervalMinutes: number) {
    const newMs = Math.max(1 * 60 * 1000, intervalMinutes * 60 * 1000)
    if (newMs === this.intervalMs) return

    this.intervalMs = newMs

    if (this.isRunning && this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = setInterval(() => {
        this.capture()
      }, this.intervalMs)
    }
  }

  /**
   * Update project/task context without stopping the session.
   * Called when user switches tasks while remaining timed in.
   * Immediately captures a screenshot for the new context.
   */
  updateContext(options: { projectId?: string; taskId?: string }) {
    this.projectId = options.projectId || ''
    this.taskId = options.taskId || ''
    if (this.isRunning) {
      this.capture()
    }
  }

  /**
   * Check if session is running
   */
  getIsRunning() {
    return this.isRunning
  }

  /**
   * Get capture count
   */
  getCaptureCount() {
    return this.captureCount
  }

  /**
   * Get time until next capture (ms)
   */
  getTimeUntilNextCapture() {
    if (!this.isRunning || !this.lastCaptureTime) return this.intervalMs
    const elapsed = Date.now() - this.lastCaptureTime
    return Math.max(0, this.intervalMs - elapsed)
  }

  private async capture() {
    if (!this.isRunning) return
    // Don't capture if too soon (minimum 30s between captures)
    const timeSinceLast = Date.now() - this.lastCaptureTime
    if (this.lastCaptureTime && timeSinceLast < 30000) return

    this.lastCaptureTime = Date.now()
    this.onCaptureStart?.()

    try {
      const canvas = await html2canvas(document.body, {
        allowTaint: true,
        useCORS: true,
        scale: window.devicePixelRatio * 0.5,
        width: window.innerWidth,
        height: window.innerHeight,
        x: window.scrollX,
        y: window.scrollY,
        logging: false,
        backgroundColor: '#ffffff',
        imageTimeout: 5000,
        ignoreElements: (element: Element) => {
          if (element instanceof HTMLElement) {
            const style = window.getComputedStyle(element)
            if (style.opacity === '0' || style.visibility === 'hidden') return true
          }
          return false
        },
      })

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error('Failed to create blob'))
          },
          'image/png',
          this.quality,
        )
      })

      const formData = new FormData()
      formData.append('file', blob, `session_${Date.now()}.png`)
      if (this.projectId) formData.append('projectId', this.projectId)
      if (this.taskId) formData.append('taskId', this.taskId)

      const res = await authFetch('/api/screenshots/auto', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        this.captureCount++
        this.onCaptureComplete?.(this.captureCount)
      } else {
        const err = await res.json().catch(() => ({}))
        this.onCaptureError?.(err.error || 'Upload failed')
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Capture failed'
      this.onCaptureError?.(msg)
    }
  }
}

// Singleton instance for the app
export const screenshotSession = new ScreenshotSessionManager()
