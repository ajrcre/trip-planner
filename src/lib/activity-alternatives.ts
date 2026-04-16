/**
 * Shared utilities for activity backup alternatives (Plan B, C, D...).
 */

/**
 * Maps a 0-based priority index to a plan label.
 * priority 0 → "Plan B", 1 → "Plan C", 2 → "Plan D", etc.
 */
export function alternativePlanLabel(priority: number): string {
  return `Plan ${String.fromCharCode(66 + priority)}`
}

/** Activity types that support backup alternatives */
export const ALTERNATIVE_SUPPORTED_TYPES = ["attraction", "meal", "grocery"] as const
export type AlternativeSupportedType = (typeof ALTERNATIVE_SUPPORTED_TYPES)[number]

export function supportsAlternatives(type: string): boolean {
  return (ALTERNATIVE_SUPPORTED_TYPES as readonly string[]).includes(type)
}
