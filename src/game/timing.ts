// Fixed pacing for every stage (no speed-up). See ADR-5 in spec/ARCHITECTURE.md.

/** How long each color stays lit while the sequence is shown. */
export const FLASH_MS = 600;
/** Dark gap between two colors, so a repeated color reads as two flashes. */
export const GAP_MS = 250;
/** Pause before a stage's sequence is shown. */
export const ROUND_PAUSE_MS = 800;
/** Light and tone feedback for a player's press. */
export const PRESS_FLASH_MS = 250;
