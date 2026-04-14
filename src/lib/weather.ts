// Open-Meteo weather API client (free, no API key required)

export interface WeatherCondition {
  code: number
  description: string // Hebrew
  icon: string // emoji
  gradient: string // Tailwind gradient classes for light mode
  gradientDark: string // Tailwind gradient classes for dark mode
}

export interface DailyWeather {
  date: string // YYYY-MM-DD
  temperatureMax: number
  temperatureMin: number
  precipitationSum: number // mm
  precipitationProbability: number // %
  weatherCode: number
  condition: WeatherCondition
}

export interface HourlyWeather {
  time: string // ISO datetime
  hour: number // 0-23
  temperature: number
  precipitationProbability: number
  weatherCode: number
}

export interface WeatherForecastData {
  daily: DailyWeather[]
  hourly: HourlyWeather[]
  timezone: string
  forecastAvailableUntil: string // YYYY-MM-DD
}

const WMO_CONDITIONS: Record<number, Omit<WeatherCondition, "code">> = {
  0: {
    description: "בהיר",
    icon: "\u2600\uFE0F",
    gradient: "from-amber-50 to-sky-50",
    gradientDark: "from-amber-950/30 to-sky-950/30",
  },
  1: {
    description: "בהיר בעיקר",
    icon: "\u{1F324}\uFE0F",
    gradient: "from-amber-50 to-sky-100",
    gradientDark: "from-amber-950/20 to-sky-950/30",
  },
  2: {
    description: "מעונן חלקית",
    icon: "\u26C5",
    gradient: "from-sky-50 to-zinc-100",
    gradientDark: "from-sky-950/30 to-zinc-800/50",
  },
  3: {
    description: "מעונן",
    icon: "\u2601\uFE0F",
    gradient: "from-zinc-100 to-slate-200",
    gradientDark: "from-zinc-800/50 to-slate-800/50",
  },
  45: {
    description: "ערפל",
    icon: "\u{1F32B}\uFE0F",
    gradient: "from-zinc-100 to-zinc-200",
    gradientDark: "from-zinc-800/60 to-zinc-900/60",
  },
  48: {
    description: "ערפל קפוא",
    icon: "\u{1F32B}\uFE0F",
    gradient: "from-zinc-100 to-zinc-200",
    gradientDark: "from-zinc-800/60 to-zinc-900/60",
  },
  51: {
    description: "טפטוף קל",
    icon: "\u{1F326}\uFE0F",
    gradient: "from-sky-50 to-blue-100",
    gradientDark: "from-sky-950/30 to-blue-950/30",
  },
  53: {
    description: "טפטוף",
    icon: "\u{1F326}\uFE0F",
    gradient: "from-sky-50 to-blue-100",
    gradientDark: "from-sky-950/30 to-blue-950/30",
  },
  55: {
    description: "טפטוף חזק",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-50 to-blue-200",
    gradientDark: "from-blue-950/30 to-blue-900/40",
  },
  56: {
    description: "טפטוף קפוא",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-50 to-slate-200",
    gradientDark: "from-blue-950/30 to-slate-800/40",
  },
  57: {
    description: "טפטוף קפוא חזק",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-50 to-slate-200",
    gradientDark: "from-blue-950/30 to-slate-800/40",
  },
  61: {
    description: "גשם קל",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-50 to-blue-200",
    gradientDark: "from-blue-950/30 to-blue-900/40",
  },
  63: {
    description: "גשם",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-100 to-slate-200",
    gradientDark: "from-blue-950/40 to-slate-800/50",
  },
  65: {
    description: "גשם חזק",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-200 to-slate-300",
    gradientDark: "from-blue-900/50 to-slate-800/60",
  },
  66: {
    description: "גשם קפוא",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-100 to-slate-200",
    gradientDark: "from-blue-950/40 to-slate-800/50",
  },
  67: {
    description: "גשם קפוא חזק",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-200 to-slate-300",
    gradientDark: "from-blue-900/50 to-slate-800/60",
  },
  71: {
    description: "שלג קל",
    icon: "\u{1F328}\uFE0F",
    gradient: "from-sky-50 to-white",
    gradientDark: "from-sky-950/20 to-zinc-800/30",
  },
  73: {
    description: "שלג",
    icon: "\u{1F328}\uFE0F",
    gradient: "from-sky-100 to-white",
    gradientDark: "from-sky-950/30 to-zinc-800/40",
  },
  75: {
    description: "שלג חזק",
    icon: "\u2744\uFE0F",
    gradient: "from-sky-200 to-white",
    gradientDark: "from-sky-900/40 to-zinc-800/50",
  },
  77: {
    description: "גרגירי שלג",
    icon: "\u2744\uFE0F",
    gradient: "from-sky-100 to-white",
    gradientDark: "from-sky-950/30 to-zinc-800/40",
  },
  80: {
    description: "ממטרים קלים",
    icon: "\u{1F326}\uFE0F",
    gradient: "from-sky-100 to-blue-200",
    gradientDark: "from-sky-950/30 to-blue-900/40",
  },
  81: {
    description: "ממטרים",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-100 to-blue-300",
    gradientDark: "from-blue-950/40 to-blue-800/50",
  },
  82: {
    description: "ממטרים חזקים",
    icon: "\u{1F327}\uFE0F",
    gradient: "from-blue-200 to-slate-300",
    gradientDark: "from-blue-900/50 to-slate-800/60",
  },
  85: {
    description: "ממטרי שלג קלים",
    icon: "\u{1F328}\uFE0F",
    gradient: "from-sky-100 to-white",
    gradientDark: "from-sky-950/30 to-zinc-800/40",
  },
  86: {
    description: "ממטרי שלג חזקים",
    icon: "\u2744\uFE0F",
    gradient: "from-sky-200 to-white",
    gradientDark: "from-sky-900/40 to-zinc-800/50",
  },
  95: {
    description: "סופת רעמים",
    icon: "\u26C8\uFE0F",
    gradient: "from-slate-200 to-zinc-300",
    gradientDark: "from-slate-800/60 to-zinc-800/70",
  },
  96: {
    description: "סופת רעמים עם ברד",
    icon: "\u26C8\uFE0F",
    gradient: "from-slate-300 to-zinc-400",
    gradientDark: "from-slate-800/70 to-zinc-700/70",
  },
  99: {
    description: "סופת רעמים עם ברד כבד",
    icon: "\u26C8\uFE0F",
    gradient: "from-slate-300 to-zinc-400",
    gradientDark: "from-slate-800/70 to-zinc-700/70",
  },
}

export function mapWeatherCode(code: number): WeatherCondition {
  const condition = WMO_CONDITIONS[code]
  if (condition) {
    return { code, ...condition }
  }
  // Fallback: find nearest known code
  const knownCodes = Object.keys(WMO_CONDITIONS).map(Number).sort((a, b) => a - b)
  const nearest = knownCodes.reduce((prev, curr) =>
    Math.abs(curr - code) < Math.abs(prev - code) ? curr : prev
  )
  return { code, ...WMO_CONDITIONS[nearest] }
}

export async function getWeatherForecast(
  lat: number,
  lng: number,
  startDate: string,
  endDate: string
): Promise<WeatherForecastData> {
  const url = new URL("https://api.open-meteo.com/v1/forecast")
  url.searchParams.set("latitude", lat.toString())
  url.searchParams.set("longitude", lng.toString())
  url.searchParams.set("daily", "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,weather_code")
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code")
  url.searchParams.set("start_date", startDate)
  url.searchParams.set("end_date", endDate)
  url.searchParams.set("timezone", "auto")

  const res = await fetch(url.toString(), { next: { revalidate: 3600 } })

  if (!res.ok) {
    throw new Error(`Open-Meteo API error: ${res.status}`)
  }

  const data = await res.json()

  const daily: DailyWeather[] = (data.daily?.time ?? []).map((date: string, i: number) => ({
    date,
    temperatureMax: Math.round(data.daily.temperature_2m_max[i]),
    temperatureMin: Math.round(data.daily.temperature_2m_min[i]),
    precipitationSum: data.daily.precipitation_sum[i] ?? 0,
    precipitationProbability: data.daily.precipitation_probability_max[i] ?? 0,
    weatherCode: data.daily.weather_code[i] ?? 0,
    condition: mapWeatherCode(data.daily.weather_code[i] ?? 0),
  }))

  const hourly: HourlyWeather[] = (data.hourly?.time ?? []).map((time: string, i: number) => ({
    time,
    hour: new Date(time).getHours(),
    temperature: Math.round(data.hourly.temperature_2m[i] * 10) / 10,
    precipitationProbability: data.hourly.precipitation_probability[i] ?? 0,
    weatherCode: data.hourly.weather_code[i] ?? 0,
  }))

  const lastDailyDate = daily.length > 0 ? daily[daily.length - 1].date : startDate

  return {
    daily,
    hourly,
    timezone: data.timezone ?? "auto",
    forecastAvailableUntil: lastDailyDate,
  }
}
