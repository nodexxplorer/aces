/**
 * The department accent. The server computes one colour per department from its
 * logo (backend/internal/tenant/accent.go) and sends it as accentColor. Here it
 * becomes the primary colour ramp that the primary-* Tailwind classes read, so
 * buttons, links and highlights take the department's colour. Without an
 * accent, the platform blue defined in index.css applies.
 */

/** An RGB colour, each channel 0 to 255. */
export type RGB = readonly [number, number, number];

/** The steps of the primary ramp, as Tailwind names them. Step 500 is the accent. */
export const PRIMARY_STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

// How far each lighter step moves from the accent toward white, and each darker
// step toward black. 0 is the accent itself, 1 is the target colour.
const TOWARD_WHITE: ReadonlyArray<readonly [number, number]> = [
  [50, 0.94],
  [100, 0.86],
  [200, 0.72],
  [300, 0.52],
  [400, 0.26],
];
const TOWARD_BLACK: ReadonlyArray<readonly [number, number]> = [
  [600, 0.14],
  [700, 0.3],
  [800, 0.46],
  [900, 0.6],
  [950, 0.76],
];

const HEX = /^#[0-9a-f]{6}$/i;

/** True for a #rrggbb colour, the only form the server sends. */
export function isAccentColor(value: unknown): value is string {
  return typeof value === 'string' && HEX.test(value);
}

function parseHex(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(from: RGB, to: RGB, t: number): RGB {
  const channel = (i: 0 | 1 | 2) => Math.round(from[i] + (to[i] - from[i]) * t);
  return [channel(0), channel(1), channel(2)];
}

/** The primary ramp for an accent: RGB for each step, with step 500 the accent. */
export function primaryRamp(accent: string): Record<(typeof PRIMARY_STEPS)[number], RGB> {
  const base = parseHex(accent);
  const ramp = { 500: base } as Record<(typeof PRIMARY_STEPS)[number], RGB>;
  for (const [step, t] of TOWARD_WHITE) ramp[step as (typeof PRIMARY_STEPS)[number]] = mix(base, WHITE, t);
  for (const [step, t] of TOWARD_BLACK) ramp[step as (typeof PRIMARY_STEPS)[number]] = mix(base, BLACK, t);
  return ramp;
}

/**
 * Sets the primary ramp from a department's accent. With no accent, it removes
 * the department's values, so the platform blue from index.css applies again.
 */
export function applyDepartmentAccent(accent: string | null | undefined): void {
  const style = document.documentElement.style;
  if (!isAccentColor(accent)) {
    for (const step of PRIMARY_STEPS) style.removeProperty(`--primary-${step}`);
    return;
  }
  const ramp = primaryRamp(accent);
  for (const step of PRIMARY_STEPS) {
    style.setProperty(`--primary-${step}`, ramp[step].join(' '));
  }
}
