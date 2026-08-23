// Single source of truth binding UI concepts to icon components.
//
// Nothing outside this file should import from "lucide-react" directly. Before
// this existed the same concept was drawn three different ways in three
// different files (attraction was 🏛️ in the timeline and 🎢 in the AI proposal
// card); routing every icon through here is what keeps that from coming back.

import {
  Armchair,
  ArrowLeftRight,
  Banknote,
  BedDouble,
  CableCar,
  CalendarDays,
  Car,
  Castle,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Church,
  CircleHelp,
  ClipboardList,
  Clock,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudHail,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Drama,
  FerrisWheel,
  Film,
  Fish,
  Flower2,
  Globe,
  HandCoins,
  Heart,
  KeyRound,
  Landmark,
  Languages,
  Library,
  Link2,
  Map,
  MapPin,
  Minus,
  Mountain,
  NotebookPen,
  Palette,
  PawPrint,
  Phone,
  Pin,
  PlaneLanding,
  PlaneTakeoff,
  Plug,
  Plus,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  Siren,
  Snowflake,
  Sparkle,
  Sparkles,
  Star,
  StarHalf,
  StickyNote,
  Sun,
  Telescope,
  ToyBrick,
  Trash2,
  Trees,
  TriangleAlert,
  Trophy,
  Umbrella,
  Users,
  UtensilsCrossed,
  Waves,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react"

/** Semantic name → icon component. Referenced by `<Icon name="..." />`. */
export const icons = {
  // Place metadata
  location: MapPin,
  phone: Phone,
  website: Globe,
  map: Map,
  hours: Clock,
  note: StickyNote,
  warning: TriangleAlert,

  // Status & rating
  check: Check,
  close: X,
  star: Star,
  starHalf: StarHalf,
  want: Heart,
  maybe: CircleHelp,

  // Navigation & controls
  chevronUp: ChevronUp,
  chevronDown: ChevronDown,
  chevronNext: ChevronRight,
  trash: Trash2,
  link: Link2,
  calendar: CalendarDays,

  // AI assistant
  ai: Sparkles,
  kids: ToyBrick,
  weatherPending: CloudSun,
  bullet: Sparkle,

  // Activity types, for the few places that need one by name
  lodging: BedDouble,
  travel: Car,

  // Destination "at a glance"
  capital: Landmark,
  population: Users,
  languages: Languages,
  currency: Banknote,
  exchangeRate: ArrowLeftRight,
  timezone: Clock,
  plug: Plug,
  emergency: Siren,
  tipping: HandCoins,
} satisfies Record<string, LucideIcon>

export type IconName = keyof typeof icons

/** Activity type → icon. Mirrors the keys of `typeConfig` in schedule-display. */
export const activityTypeIcons: Record<string, LucideIcon> = {
  attraction: Landmark,
  meal: UtensilsCrossed,
  travel: Car,
  rest: Armchair,
  custom: NotebookPen,
  grocery: ShoppingCart,
  flight_departure: PlaneTakeoff,
  flight_arrival: PlaneLanding,
  car_pickup: KeyRound,
  car_return: KeyRound,
  lodging: BedDouble,
}

/** Shown when an activity has a type we don't recognise. */
export const fallbackActivityIcon: LucideIcon = Pin

export const dayTypeIcons: Record<string, LucideIcon> = {
  arrival: PlaneTakeoff,
  departure: PlaneLanding,
  full_day: Sun,
}

export const actionTypeIcons: Record<string, LucideIcon> = {
  add_activity: Plus,
  remove_activity: Minus,
  replace_day_activities: RefreshCw,
  plan_full_trip: ClipboardList,
}

/**
 * Google Place type → icon, so a museum, a zoo and a beach don't all render as
 * the same generic landmark. Keyed by the same strings as `attractionTypeMap`
 * in attraction-types.ts; anything unmatched falls back to `Landmark`.
 */
export const attractionTypeIcons: Record<string, LucideIcon> = {
  museum: Landmark,
  art_gallery: Palette,
  park: Trees,
  national_park: Trees,
  state_park: Trees,
  zoo: PawPrint,
  aquarium: Fish,
  amusement_park: FerrisWheel,
  water_park: Waves,
  church: Church,
  mosque: Church,
  synagogue: Church,
  hindu_temple: Church,
  place_of_worship: Church,
  historical_landmark: Castle,
  historical_place: Castle,
  hiking_area: Mountain,
  natural_feature: Mountain,
  beach: Umbrella,
  botanical_garden: Flower2,
  garden: Flower2,
  shopping_mall: ShoppingBag,
  market: ShoppingBag,
  performing_arts_theater: Drama,
  movie_theater: Film,
  library: Library,
  stadium: Trophy,
  sports_complex: Trophy,
  winery: Wine,
  cable_car: CableCar,
  funicular: CableCar,
  observation_deck: Telescope,
  playground: ToyBrick,
  amusement_center: ToyBrick,
  ski_resort: Snowflake,
  go_karting_venue: Trophy,
  sports_activity_location: Trophy,
  sports_club: Trophy,
  spa: Flower2,
  hotel: BedDouble,
  lodging: BedDouble,
}

/** Icon for an attraction, given the stored Google Place type (may be null). */
export function attractionIcon(attractionType: string | null | undefined): LucideIcon {
  if (!attractionType) return Landmark
  return attractionTypeIcons[attractionType] ?? Landmark
}

/**
 * WMO weather code → icon. The 30 codes in `WMO_CONDITIONS` collapse onto these
 * ten; `weatherIcon()` resolves a code to one.
 */
export const weatherIcons = {
  clear: Sun,
  mainlyClear: CloudSun,
  cloudy: Cloud,
  fog: CloudFog,
  drizzle: CloudDrizzle,
  rain: CloudRain,
  snow: CloudSnow,
  freezing: Snowflake,
  thunderstorm: CloudLightning,
  hail: CloudHail,
} satisfies Record<string, LucideIcon>
