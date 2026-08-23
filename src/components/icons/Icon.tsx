// Renders an icon from the registry at a consistent stroke weight and size.
//
// Going through this wrapper rather than rendering Lucide components directly
// is what keeps ~160 call sites from each picking their own stroke width and
// forgetting aria-hidden on decorative icons.

import { icons, type IconName } from "@/lib/icons"
import type { LucideIcon } from "lucide-react"

const SIZES = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-8 w-8",
  "2xl": "h-12 w-12",
} as const

export type IconSize = keyof typeof SIZES

type BaseProps = {
  size?: IconSize
  className?: string
  /** Set only when the icon carries meaning on its own; otherwise it is hidden from screen readers. */
  label?: string
}

/** Render an icon by its semantic name. */
export function Icon({ name, ...rest }: BaseProps & { name: IconName }) {
  return <IconOf component={icons[name]} {...rest} />
}

/**
 * Render an icon component resolved at runtime — activity types, weather codes
 * and attraction types look theirs up in a map, so there is no static name.
 */
export function IconOf({
  component: Component,
  size = "md",
  className = "",
  label,
}: BaseProps & { component: LucideIcon }) {
  return (
    <Component
      className={`${SIZES[size]} shrink-0 ${className}`.trim()}
      strokeWidth={1.75}
      aria-hidden={label ? undefined : true}
      aria-label={label}
    />
  )
}
