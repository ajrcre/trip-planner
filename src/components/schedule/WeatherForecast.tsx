"use client"

import type { DailyWeather, HourlyWeather } from "@/lib/weather"

interface WeatherForecastProps {
  dailyWeather: DailyWeather | null
  hourlyWeather: HourlyWeather[] | null
  isNearDate: boolean
  isLoading: boolean
}

// Map gradient keys to actual Tailwind classes so JIT scanner can find them
const GRADIENT_CLASSES: Record<string, string> = {
  "from-amber-50 to-sky-50": "bg-gradient-to-l from-amber-50 to-sky-50 dark:from-amber-950/30 dark:to-sky-950/30",
  "from-amber-50 to-sky-100": "bg-gradient-to-l from-amber-50 to-sky-100 dark:from-amber-950/20 dark:to-sky-950/30",
  "from-sky-50 to-zinc-100": "bg-gradient-to-l from-sky-50 to-zinc-100 dark:from-sky-950/30 dark:to-zinc-800/50",
  "from-zinc-100 to-slate-200": "bg-gradient-to-l from-zinc-100 to-slate-200 dark:from-zinc-800/50 dark:to-slate-800/50",
  "from-zinc-100 to-zinc-200": "bg-gradient-to-l from-zinc-100 to-zinc-200 dark:from-zinc-800/60 dark:to-zinc-900/60",
  "from-sky-50 to-blue-100": "bg-gradient-to-l from-sky-50 to-blue-100 dark:from-sky-950/30 dark:to-blue-950/30",
  "from-blue-50 to-blue-200": "bg-gradient-to-l from-blue-50 to-blue-200 dark:from-blue-950/30 dark:to-blue-900/40",
  "from-blue-50 to-slate-200": "bg-gradient-to-l from-blue-50 to-slate-200 dark:from-blue-950/30 dark:to-slate-800/40",
  "from-blue-100 to-slate-200": "bg-gradient-to-l from-blue-100 to-slate-200 dark:from-blue-950/40 dark:to-slate-800/50",
  "from-blue-200 to-slate-300": "bg-gradient-to-l from-blue-200 to-slate-300 dark:from-blue-900/50 dark:to-slate-800/60",
  "from-sky-50 to-white": "bg-gradient-to-l from-sky-50 to-white dark:from-sky-950/20 dark:to-zinc-800/30",
  "from-sky-100 to-white": "bg-gradient-to-l from-sky-100 to-white dark:from-sky-950/30 dark:to-zinc-800/40",
  "from-sky-200 to-white": "bg-gradient-to-l from-sky-200 to-white dark:from-sky-900/40 dark:to-zinc-800/50",
  "from-sky-100 to-blue-200": "bg-gradient-to-l from-sky-100 to-blue-200 dark:from-sky-950/30 dark:to-blue-900/40",
  "from-blue-100 to-blue-300": "bg-gradient-to-l from-blue-100 to-blue-300 dark:from-blue-950/40 dark:to-blue-800/50",
  "from-slate-200 to-zinc-300": "bg-gradient-to-l from-slate-200 to-zinc-300 dark:from-slate-800/60 dark:to-zinc-800/70",
  "from-slate-300 to-zinc-400": "bg-gradient-to-l from-slate-300 to-zinc-400 dark:from-slate-800/70 dark:to-zinc-700/70",
}

function getGradientClass(gradient: string): string {
  return GRADIENT_CLASSES[gradient] ?? "bg-gradient-to-l from-zinc-50 to-zinc-100 dark:from-zinc-800/50 dark:to-zinc-900/50"
}

function HourlyChart({ hours }: { hours: HourlyWeather[] }) {
  if (hours.length === 0) return null

  const temps = hours.map((h) => h.temperature)
  const minTemp = Math.min(...temps) - 2
  const maxTemp = Math.max(...temps) + 2
  const tempRange = maxTemp - minTemp || 1

  const chartW = Math.max(hours.length * 36, 600)
  const chartH = 140
  const padTop = 24
  const padBottom = 36
  const padX = 12
  const plotH = chartH - padTop - padBottom
  const plotW = chartW - padX * 2

  function tempY(temp: number) {
    return padTop + plotH - ((temp - minTemp) / tempRange) * plotH
  }

  function hourX(i: number) {
    return padX + (i / (hours.length - 1)) * plotW
  }

  // Build temperature polyline points
  const linePoints = hours
    .map((h, i) => `${hourX(i)},${tempY(h.temperature)}`)
    .join(" ")

  // Build area polygon (closed shape for gradient fill)
  const areaPoints = [
    `${hourX(0)},${padTop + plotH}`,
    ...hours.map((h, i) => `${hourX(i)},${tempY(h.temperature)}`),
    `${hourX(hours.length - 1)},${padTop + plotH}`,
  ].join(" ")

  return (
    <div className="overflow-x-auto rounded-lg" dir="ltr">
      <svg
        width={chartW}
        height={chartH}
        viewBox={`0 0 ${chartW} ${chartH}`}
        className="min-w-full"
      >
        <defs>
          <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
          </linearGradient>
          <linearGradient id="rainGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#93c5fd" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        {/* Temperature area fill */}
        <polygon points={areaPoints} fill="url(#tempGradient)" />

        {/* Temperature line */}
        <polyline
          points={linePoints}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Temperature dots and labels */}
        {hours.map((h, i) => {
          const x = hourX(i)
          const y = tempY(h.temperature)
          const showLabel = i % 3 === 0 || i === hours.length - 1
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="3" fill="#3b82f6" />
              {showLabel && (
                <text
                  x={x}
                  y={y - 8}
                  textAnchor="middle"
                  className="fill-zinc-600 dark:fill-zinc-300"
                  fontSize="10"
                  fontWeight="500"
                >
                  {Math.round(h.temperature)}°
                </text>
              )}
            </g>
          )
        })}

        {/* Rain probability bars */}
        {hours.map((h, i) => {
          if (h.precipitationProbability <= 0) return null
          const x = hourX(i)
          const barMaxH = 16
          const barH = (h.precipitationProbability / 100) * barMaxH
          const barW = Math.min(12, plotW / hours.length - 2)
          return (
            <rect
              key={`rain-${i}`}
              x={x - barW / 2}
              y={padTop + plotH - barH}
              width={barW}
              height={barH}
              rx="2"
              fill="url(#rainGradient)"
            />
          )
        })}

        {/* Hour labels */}
        {hours.map((h, i) => {
          if (i % 2 !== 0) return null
          const x = hourX(i)
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={chartH - 8}
              textAnchor="middle"
              className="fill-zinc-400 dark:fill-zinc-500"
              fontSize="10"
            >
              {String(h.hour).padStart(2, "0")}:00
            </text>
          )
        })}

        {/* Rain legend if any rain */}
        {hours.some((h) => h.precipitationProbability > 0) && (
          <g>
            <rect x={chartW - 80} y={2} width="8" height="8" rx="2" fill="url(#rainGradient)" />
            <text
              x={chartW - 68}
              y={10}
              className="fill-zinc-400 dark:fill-zinc-500"
              fontSize="9"
            >
              סיכוי גשם
            </text>
          </g>
        )}
      </svg>
    </div>
  )
}

export function WeatherForecast({
  dailyWeather,
  hourlyWeather,
  isNearDate,
  isLoading,
}: WeatherForecastProps) {
  if (isLoading) {
    return (
      <div className="animate-pulse rounded-xl border border-zinc-200 bg-zinc-100 p-4 dark:border-zinc-700 dark:bg-zinc-800">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-700" />
          <div className="flex flex-col gap-2">
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-700" />
            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
          </div>
        </div>
      </div>
    )
  }

  if (!dailyWeather) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="text-lg opacity-40">{"\u{1F324}\uFE0F"}</span>
        <span className="text-xs text-zinc-400">
          {"תחזית מזג אוויר תהיה זמינה קרוב יותר למועד"}
        </span>
      </div>
    )
  }

  const { condition } = dailyWeather

  return (
    <div
      className={`overflow-hidden rounded-xl border border-zinc-200/80 ${getGradientClass(condition.gradient)} dark:border-zinc-700/80`}
    >
      {/* Daily summary */}
      <div className="flex items-center gap-4 px-4 py-3">
        <span className="text-3xl">{condition.icon}</span>

        <div className="flex flex-col gap-0.5">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-zinc-800 dark:text-zinc-100">
              {dailyWeather.temperatureMax}°
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              / {dailyWeather.temperatureMin}°
            </span>
          </div>
          <span className="text-xs text-zinc-600 dark:text-zinc-300">
            {condition.description}
          </span>
        </div>

        {dailyWeather.precipitationProbability > 0 && (
          <div className="mr-auto flex items-center gap-1.5 rounded-full bg-blue-100/60 px-2.5 py-1 dark:bg-blue-900/30">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-blue-500">
              <path
                d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0L12 2.69z"
                fill="currentColor"
                opacity="0.6"
              />
            </svg>
            <span className="text-xs font-medium text-blue-700 dark:text-blue-300">
              {dailyWeather.precipitationProbability}%
            </span>
            {dailyWeather.precipitationSum > 0 && (
              <span className="text-[10px] text-blue-500 dark:text-blue-400">
                ({dailyWeather.precipitationSum.toFixed(1)} מ״מ)
              </span>
            )}
          </div>
        )}
      </div>

      {/* Hourly chart for near dates */}
      {isNearDate && hourlyWeather && hourlyWeather.length > 0 && (
        <div className="border-t border-zinc-200/50 bg-white/40 px-2 py-2 dark:border-zinc-700/50 dark:bg-zinc-900/20">
          <HourlyChart hours={hourlyWeather} />
        </div>
      )}
    </div>
  )
}
