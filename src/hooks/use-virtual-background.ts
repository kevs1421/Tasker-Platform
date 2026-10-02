'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────

type BackgroundType = 'none' | 'blur' | 'image'

export interface VirtualBackgroundOption {
  id: string
  label: string
  type: BackgroundType
  /** URL for preset images, or data URL for uploaded images */
  src?: string
  /** Thumbnail for the picker */
  thumbnail?: string
}

interface VirtualBackgroundState {
  /** Currently selected background */
  selected: VirtualBackgroundOption
  /** Whether the virtual background processor is active */
  isActive: boolean
  /** Loading state while MediaPipe initializes */
  isLoading: boolean
}

// ─── Preset Backgrounds ───────────────────────────────────────────────

const PRESET_BACKGROUNDS: VirtualBackgroundOption[] = [
  { id: 'none', label: 'None', type: 'none' },
  { id: 'blur', label: 'Blur', type: 'blur' },
  { id: 'office', label: 'Office', type: 'image', src: '/virtual-backgrounds/office.png', thumbnail: '/virtual-backgrounds/office.png' },
  { id: 'nature', label: 'Nature', type: 'image', src: '/virtual-backgrounds/nature.png', thumbnail: '/virtual-backgrounds/nature.png' },
  { id: 'living-room', label: 'Living Room', type: 'image', src: '/virtual-backgrounds/living-room.png', thumbnail: '/virtual-backgrounds/living-room.png' },
  { id: 'gradient', label: 'Gradient', type: 'image', src: '/virtual-backgrounds/gradient.png', thumbnail: '/virtual-backgrounds/gradient.png' },
  { id: 'space', label: 'Space', type: 'image', src: '/virtual-backgrounds/space.png', thumbnail: '/virtual-backgrounds/space.png' },
  { id: 'beach', label: 'Beach', type: 'image', src: '/virtual-backgrounds/beach.png', thumbnail: '/virtual-backgrounds/beach.png' },
]

// ─── Hook ─────────────────────────────────────────────────────────────

/**
 * Manages virtual background processing using MediaPipe Selfie Segmentation.
 *
 * How it works:
 * 1. The raw camera stream is drawn to an offscreen canvas each frame.
 * 2. MediaPipe segmentates the person vs background.
 * 3. The output canvas composites: person pixels stay, background is replaced
 *    with either a blur effect or a background image.
 * 4. The canvas stream is captured and returned as the "processed" video track
 *    that should be sent to WebRTC peers.
 */
export function useVirtualBackground() {
  const [selected, setSelected] = useState<VirtualBackgroundOption>(PRESET_BACKGROUNDS[0])
  const [isActive, setIsActive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [customBackgrounds, setCustomBackgrounds] = useState<VirtualBackgroundOption[]>([])

  // Refs for the processing pipeline
  const segmenterRef = useRef<any>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const rawVideoRef = useRef<HTMLVideoElement | null>(null)
  const animFrameRef = useRef<number>(0)
  const bgImageLoadingRef = useRef(false)

  // Track whether we've initialized MediaPipe
  const initializedRef = useRef(false)

  // ── Load background image ──

  const loadBackgroundImage = useCallback((src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        bgImageRef.current = img
        resolve(img)
      }
      img.onerror = () => reject(new Error('Failed to load background image'))
      img.src = src
    })
  }, [])

  // ── Initialize MediaPipe segmenter ──

  const initSegmenter = useCallback(async () => {
    if (segmenterRef.current) return

    setIsLoading(true)
    try {
      // Dynamic import to avoid loading MediaPipe unless needed
      const { SelfieSegmentation } = await import('@mediapipe/selfie_segmentation')

      const segmenter = new SelfieSegmentation({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`
        },
      })

      segmenter.setOptions({
        modelSelection: 1, // 1 = landscape model (faster, good for video calls)
        selfieMode: true,
      })

      segmenter.onResults((results: any) => {
        onSegmentationResults(results)
      })

      segmenterRef.current = segmenter
      initializedRef.current = true
    } catch {
      toast.error('Virtual background requires a supported browser')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // ── Process segmentation results ──

  const onSegmentationResults = useCallback((results: any) => {
    const ctx = ctxRef.current
    const canvas = canvasRef.current
    const bgImg = bgImageRef.current
    const rawVideo = rawVideoRef.current
    if (!ctx || !canvas || !rawVideo) return

    const width = canvas.width
    const height = canvas.height

    // Draw the segmentation mask
    const segmentationMask = results.segmentationMask

    if (selected.type === 'blur') {
      // ── Blur background ──
      // Step 1: Draw the original frame (will be the background)
      ctx.save()
      ctx.filter = 'blur(12px)'
      ctx.drawImage(results.image, 0, 0, width, height)
      ctx.restore()

      // Step 2: Draw the person on top using the segmentation mask
      ctx.save()
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(segmentationMask, 0, 0, width, height)
      ctx.restore()

      // Step 3: Draw the person (unblurred) where the mask is
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      ctx.drawImage(results.image, 0, 0, width, height)
      ctx.restore()
    } else if (selected.type === 'image' && bgImg) {
      // ── Image background ──
      // Step 1: Draw the background image
      ctx.drawImage(bgImg, 0, 0, width, height)

      // Step 2: Clear the person area using the mask (inverted)
      ctx.save()
      ctx.globalCompositeOperation = 'destination-in'
      // Invert mask: we want to keep background where there's NO person
      // So we draw the inverted segmentation mask
      ctx.drawImage(segmentationMask, 0, 0, width, height)
      ctx.restore()

      // Step 3: Draw the person on top
      ctx.save()
      ctx.globalCompositeOperation = 'destination-over'
      ctx.drawImage(results.image, 0, 0, width, height)
      ctx.restore()
    } else {
      // ── No background (passthrough) ──
      ctx.drawImage(results.image, 0, 0, width, height)
    }
  }, [selected])

  // ── Processing loop ──

  const processFrame = useCallback(async () => {
    const segmenter = segmenterRef.current
    const rawVideo = rawVideoRef.current
    if (!segmenter || !rawVideo || rawVideo.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(processFrame)
      return
    }

    try {
      await segmenter.send({ image: rawVideo })
    } catch {
      // Ignore frame processing errors (can happen during cleanup)
    }

    animFrameRef.current = requestAnimationFrame(processFrame)
  }, [])

  // ── Start the virtual background processing ──

  const startProcessing = useCallback(async (rawStream: MediaStream): Promise<MediaStream | null> => {
    if (selected.type === 'none') return null

    // Initialize segmenter if not done
    if (!initializedRef.current) {
      await initSegmenter()
    }

    if (!segmenterRef.current) return null

    // Load background image if needed
    if (selected.type === 'image' && selected.src && !bgImageLoadingRef.current) {
      bgImageLoadingRef.current = true
      try {
        await loadBackgroundImage(selected.src)
      } catch {
        toast.error('Failed to load background image')
        bgImageLoadingRef.current = false
        return null
      }
      bgImageLoadingRef.current = false
    }

    // Create the hidden video element to receive raw camera frames
    const rawVideo = document.createElement('video')
    rawVideo.srcObject = rawStream
    rawVideo.muted = true
    rawVideo.playsInline = true
    await rawVideo.play()
    rawVideoRef.current = rawVideo

    // Get video dimensions
    const track = rawStream.getVideoTracks()[0]
    const settings = track.getSettings()
    const width = settings.width || 640
    const height = settings.height || 480

    // Create the output canvas
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvasRef.current = canvas

    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctxRef.current = ctx

    // Start the processing loop
    setIsActive(true)
    animFrameRef.current = requestAnimationFrame(processFrame)

    // Return the canvas stream
    const canvasStream = canvas.captureStream(30)
    return canvasStream
  }, [selected, initSegmenter, loadBackgroundImage, processFrame])

  // ── Stop processing ──

  const stopProcessing = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = 0
    }
    if (rawVideoRef.current) {
      rawVideoRef.current.pause()
      rawVideoRef.current.srcObject = null
      rawVideoRef.current = null
    }
    canvasRef.current = null
    ctxRef.current = null
    setIsActive(false)
  }, [])

  // ── Switch background ──

  const switchBackground = useCallback(async (option: VirtualBackgroundOption) => {
    setSelected(option)

    // If switching to an image background, preload it
    if (option.type === 'image' && option.src) {
      try {
        await loadBackgroundImage(option.src)
      } catch {
        toast.error('Failed to load background image')
      }
    }
  }, [loadBackgroundImage])

  // ── Upload custom background ──

  const uploadCustomBackground = useCallback(async (file: File): Promise<VirtualBackgroundOption | null> => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file')
      return null
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB')
      return null
    }

    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        if (!dataUrl) {
          toast.error('Failed to read image')
          resolve(null)
          return
        }

        const id = `custom-${Date.now()}`
        const option: VirtualBackgroundOption = {
          id,
          label: file.name.replace(/\.[^/.]+$/, ''),
          type: 'image',
          src: dataUrl,
          thumbnail: dataUrl,
        }

        setCustomBackgrounds((prev) => [...prev, option])
        toast.success('Background uploaded!')
        resolve(option)
      }
      reader.onerror = () => {
        toast.error('Failed to read image file')
        resolve(null)
      }
      reader.readAsDataURL(file)
    })
  }, [])

  // ── Cleanup on unmount ──

  useEffect(() => {
    return () => {
      stopProcessing()
      if (segmenterRef.current) {
        segmenterRef.current.close()
        segmenterRef.current = null
      }
    }
  }, [stopProcessing])

  return {
    selected,
    isActive,
    isLoading,
    customBackgrounds,
    allBackgrounds: [...PRESET_BACKGROUNDS, ...customBackgrounds],
    startProcessing,
    stopProcessing,
    switchBackground,
    uploadCustomBackground,
  }
}
