import type { Weather } from './model'

async function fetchJson<T>(url: string, timeoutMs = 9000): Promise<T> {
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { signal: controller.signal })
    if (!response.ok) throw new Error(`天气服务返回 ${response.status}`)
    return (await response.json()) as T
  } finally {
    window.clearTimeout(timer)
  }
}

interface ReverseGeocodeResult {
  city?: string
  locality?: string
  principalSubdivision?: string
  countryName?: string
}

export async function getPlaceAtLocation(latitude: number, longitude: number): Promise<string> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: 'zh-Hans',
  })
  const result = await fetchJson<ReverseGeocodeResult>(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?${params}`,
    6000,
  )
  const city = result.city || result.principalSubdivision || result.countryName || ''
  const locality = result.locality && result.locality !== city ? result.locality : ''
  const label = [city, locality].filter(Boolean).join(' · ')
  if (!label) throw new Error('地名查询失败')
  return label
}

export async function getWeatherAtLocation(latitude: number, longitude: number): Promise<Weather> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: 'temperature_2m,apparent_temperature,weather_code,precipitation,wind_speed_10m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: '1',
  })
  const forecast = await fetchJson<{
    current?: {
      temperature_2m: number
      apparent_temperature: number
      weather_code: number
      precipitation: number
      wind_speed_10m: number
    }
    daily?: {
      temperature_2m_max: number[]
      temperature_2m_min: number[]
      precipitation_probability_max: number[]
    }
  }>(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!forecast.current) throw new Error('暂时没有当前位置的天气数据')

  return {
    source: 'live',
    city: '当前位置',
    temperature: Math.round(forecast.current.temperature_2m),
    feelsLike: Math.round(forecast.current.apparent_temperature),
    min: forecast.daily?.temperature_2m_min[0] ?? null,
    max: forecast.daily?.temperature_2m_max[0] ?? null,
    rainChance: forecast.daily?.precipitation_probability_max[0] ?? null,
    code: forecast.current.weather_code,
    wind: forecast.current.wind_speed_10m,
    fetchedAt: Date.now(),
  }
}

export function weatherDescription(code: number | null, rainChance: number | null): string {
  if (code === null) return rainChance !== null && rainChance >= 50 ? '可能有雨' : '手动天气'
  if (code === 0) return '晴朗'
  if (code <= 3) return '多云'
  if (code <= 48) return '雾'
  if (code <= 67 || code >= 80 && code <= 82) return '有雨'
  if (code <= 77 || code >= 85 && code <= 86) return '有雪'
  if (code >= 95) return '雷雨'
  return '多云'
}

export function isRainy(weather: Weather): boolean {
  return (weather.rainChance ?? 0) >= 50 || (weather.code !== null && (weather.code >= 51 && weather.code <= 67 || weather.code >= 80 && weather.code <= 82 || weather.code >= 95))
}
