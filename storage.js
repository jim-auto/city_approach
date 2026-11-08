const BEST_KEY = "city_approach_best";
const DIFF_KEY = "city_approach_difficulty";
const HEIGHT_KEY = "city_approach_height";
const MODE_KEY = "city_approach_sprite_mode";

export const SPRITE_MODES = [
  { key: "pixel", label: "ドット" },
  { key: "icon",  label: "AI画像" },
];

export const DIFFICULTIES = [
  { key: "easy",   label: "やさしい", persona: "ガチイケ", baseMod:  0.06, noiseMod: -0.02, mult: 0.7 },
  { key: "normal", label: "ふつう", persona: "フツメン", baseMod:  0,    noiseMod:  0,    mult: 1.0 },
  { key: "hard",   label: "むずかしい", persona: "オジ", baseMod: -0.04, noiseMod:  0.04, mult: 1.4 },
];

function safeGet(key) {
  try { return window.localStorage.getItem(key); } catch { return null; }
}
function safeSet(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function getBest() {
  const raw = safeGet(BEST_KEY);
  const n = parseInt(raw ?? "0", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function setBest(n) {
  const v = Math.max(0, Math.round(n));
  safeSet(BEST_KEY, String(v));
}

export function getDifficulty() {
  const key = safeGet(DIFF_KEY);
  return DIFFICULTIES.find((d) => d.key === key) || DIFFICULTIES[0];
}

export function setDifficulty(key) {
  if (!DIFFICULTIES.some((d) => d.key === key)) return;
  safeSet(DIFF_KEY, key);
}

export function cycleDifficulty(currentKey) {
  const idx = DIFFICULTIES.findIndex((d) => d.key === currentKey);
  const next = DIFFICULTIES[(idx + 1) % DIFFICULTIES.length];
  setDifficulty(next.key);
  return next;
}

export function getSpriteMode() {
  return SPRITE_MODES[1];
}

export function setSpriteMode(key) {
  if (!SPRITE_MODES.some((m) => m.key === key)) return;
  safeSet(MODE_KEY, key);
}

export function cycleSpriteMode(currentKey) {
  const idx = SPRITE_MODES.findIndex((m) => m.key === currentKey);
  const next = SPRITE_MODES[(idx + 1) % SPRITE_MODES.length];
  setSpriteMode(next.key);
  return next;
}

export const HEIGHTS = [
  { key: 'tall', label: '高身長', figureScale: 1 },
  { key: 'short', label: '低身長', figureScale: .88 },
];
export function heightFor(key) { return HEIGHTS.find(h => h.key === key) || HEIGHTS[0]; }
export function getHeight() { return heightFor(safeGet(HEIGHT_KEY)); }
export function cycleHeight(key) {
  const next = HEIGHTS[(HEIGHTS.findIndex(h => h.key === key) + 1) % HEIGHTS.length];
  safeSet(HEIGHT_KEY, next.key); return next;
}
