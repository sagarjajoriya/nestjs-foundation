/** Multipliers (to milliseconds) for supported duration units. */
const UNIT_MS = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
} as const;

type DurationUnit = keyof typeof UNIT_MS;

/**
 * Parses a human duration string (e.g. `"15m"`, `"7d"`, `"3600s"`, `"500ms"`)
 * into milliseconds. A bare number is interpreted as seconds.
 *
 * Throws on malformed input so a misconfigured TTL fails fast at boot rather
 * than silently producing a wrong expiry.
 */
export function parseDurationToMs(value: string): number {
  const trimmed = value.trim();

  if (/^\d+$/.test(trimmed)) {
    return Number(trimmed) * UNIT_MS.s;
  }

  const match = /^(\d+)\s*(ms|s|m|h|d|w)$/.exec(trimmed);
  if (!match) {
    throw new Error(`Invalid duration: "${value}"`);
  }

  const amount = Number(match[1]);
  const unit = match[2] as DurationUnit;
  return amount * UNIT_MS[unit];
}
