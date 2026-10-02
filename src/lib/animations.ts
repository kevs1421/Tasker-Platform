/**
 * Shared Framer Motion animation variants.
 * Single source of truth for animations used across the app.
 */
export const fadeIn = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.25 },
}

export const staggerContainer = {
  initial: {},
  animate: { transition: { staggerChildren: 0.05 } },
}

export const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25 },
}
