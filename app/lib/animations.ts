import type { Transition } from "framer-motion";

/**
 * Unified animation presets for all framer-motion content transitions.
 *
 * Every content enter/exit animation in the app uses the same movement:
 * fade + slight vertical slide.
 *
 * Usage:
 *   <motion.div {...contentMotion} />
 *   <motion.div {...contentMotion} animate={{ opacity: 0.15, y: 0 }} /> // override
 *
 * Pure overlays (modal backdrops) use `backdropMotion` — opacity only,
 * since a dimming layer should never move.
 *
 * NOT applied to: infinite loops (shimmer, pulse), layout animations
 * (sidebar width, height collapse), and hover/tap micro-interactions.
 */

export const contentTransition: Transition = {
  duration: 0.25,
  ease: "easeInOut",
};

/** Standard content enter/exit: fade + vertical slide. */
export const contentMotion = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: contentTransition,
};

/** Backdrop/overlay dimming: opacity only (no movement). */
export const backdropMotion = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: contentTransition,
};
