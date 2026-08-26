import { create } from 'zustand'

// ─── Shared types ───────────────────────────────────────

export interface ActiveTimeSession {
  id: string
  timeIn: string
  projectId?: string | null
  project?: { id: string; name: string; color?: string } | null
  task?: { id: string; title: string; status?: string } | null
  description?: string | null
}

// ─── Screenshot session state (synced across components) ─

interface ScreenshotState {
  isCapturing: boolean
  captureCount: number
  nextCaptureInMs: number
  intervalMinutes: number

  setIsCapturing: (v: boolean) => void
  setCaptureCount: (v: number) => void
  setNextCaptureInMs: (v: number) => void
  setIntervalMinutes: (v: number) => void
  resetScreenshotState: () => void
}

const initialScreenshot: Omit<ScreenshotState, 'setIsCapturing' | 'setCaptureCount' | 'setNextCaptureInMs' | 'setIntervalMinutes' | 'resetScreenshotState'> = {
  isCapturing: false,
  captureCount: 0,
  nextCaptureInMs: 0,
  intervalMinutes: 5,
}

export const useScreenshotStore = create<ScreenshotState>((set) => ({
  ...initialScreenshot,
  setIsCapturing: (v) => set({ isCapturing: v }),
  setCaptureCount: (v) => set({ captureCount: v }),
  setNextCaptureInMs: (v) => set({ nextCaptureInMs: v }),
  setIntervalMinutes: (v) => set({ intervalMinutes: v }),
  resetScreenshotState: () => set(initialScreenshot),
}))

// ─── Time-tracking store ────────────────────────────────
// Shared between the sidebar widget (app-shell.tsx) and the
// Time Tracking page (team-dashboard.tsx) so that clocking
// in / out from either location stays perfectly in sync.

interface TimeTrackingState {
  /** The currently active timed-in entry, or null */
  activeSession: ActiveTimeSession | null
  /** Whether we are performing a time-in request */
  clockingIn: boolean
  /** Whether we are performing a time-out request */
  clockingOut: boolean
  /** Timestamp (epoch ms) when the active session started — for elapsed timer */
  startTimeMs: number
  /** Whether the initial fetch has completed */
  initialized: boolean

  // Actions
  setActiveSession: (session: ActiveTimeSession | null) => void
  setClockingIn: (v: boolean) => void
  setClockingOut: (v: boolean) => void
  setInitialized: (v: boolean) => void
  reset: () => void
}

export const useTimeTrackingStore = create<TimeTrackingState>((set) => ({
  activeSession: null,
  clockingIn: false,
  clockingOut: false,
  startTimeMs: 0,
  initialized: false,

  setActiveSession: (session) =>
    set({
      activeSession: session,
      startTimeMs: session ? new Date(session.timeIn).getTime() : 0,
    }),
  setClockingIn: (v) => set({ clockingIn: v }),
  setClockingOut: (v) => set({ clockingOut: v }),
  setInitialized: (v) => set({ initialized: v }),
  reset: () =>
    set({
      activeSession: null,
      clockingIn: false,
      clockingOut: false,
      startTimeMs: 0,
    }),
}))