/** Zoom level at which a hovered node begins its enter-cue (glow + slowed scroll). */
export const ZOOM_CUE_MIN = 0.85;

/** Zoom level at which a hovered node fully expands (features revealed, canvas locks). */
export const ZOOM_EXPAND_MIN = 1.1;

/**
 * Width of the exit-cue zone above ZOOM_EXPAND_MIN.
 * While zoom is in [ZOOM_EXPAND_MIN, ZOOM_EXPAND_MIN + EXIT_CUE_RANGE], the expanded
 * node shows a breathing glow and zoom-out is slowed — the "nudge" signalling
 * "a little more and you'll exit focus mode".
 */
export const ZOOM_EXIT_CUE_RANGE = 0.12;
