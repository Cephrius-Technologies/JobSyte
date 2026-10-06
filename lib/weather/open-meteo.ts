import "server-only";

export type ForecastDay = {
  date: string;
  code: number;
  high: number;
  low: number;
  rainChance: number | null;
};

export type SevenDayForecast = {
  location: string;
  days: ForecastDay[];
};

export type WeatherCity = {
  id: number;
  name: string;
  admin1: string | null;
  country: string;
  latitude: number;
  longitude: number;
};

function geocodingUrl(path: string, apiKey: string | undefined) {
  const url = new URL(`https://${apiKey ? "customer-" : ""}geocoding-api.open-meteo.com/v1/${path}`);
  if (apiKey) url.searchParams.set("apikey", apiKey);
  return url;
}

function parseWeatherCity(value: unknown): WeatherCity | null {
  if (!value || typeof value !== "object") return null;
  const city = value as Record<string, unknown>;
  if (!Number.isSafeInteger(city.id) || Number(city.id) <= 0 ||
      typeof city.name !== "string" || !city.name ||
      typeof city.country !== "string" || !city.country ||
      typeof city.latitude !== "number" || !Number.isFinite(city.latitude) ||
      typeof city.longitude !== "number" || !Number.isFinite(city.longitude)) return null;
  return {
    id: city.id as number,
    name: city.name,
    admin1: typeof city.admin1 === "string" ? city.admin1 : null,
    country: city.country,
    latitude: city.latitude,
    longitude: city.longitude,
  };
}

export async function searchWeatherCities(query: string): Promise<WeatherCity[]> {
  const apiKey = process.env.OPEN_METEO_API_KEY?.trim();
  if (!apiKey && process.env.NODE_ENV === "production") return [];
  const term = query.trim();
  if (term.length < 2 || term.length > 100) return [];
  const url = geocodingUrl("search", apiKey);
  url.searchParams.set("name", term);
  url.searchParams.set("count", "8");
  url.searchParams.set("language", "en");
  const response = await fetch(url, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return [];
  const result = await response.json() as { results?: unknown[] };
  return Array.isArray(result.results)
    ? result.results.map(parseWeatherCity).filter((city): city is WeatherCity => city !== null)
    : [];
}

export async function getWeatherCity(id: number): Promise<WeatherCity | null> {
  const apiKey = process.env.OPEN_METEO_API_KEY?.trim();
  if (!apiKey && process.env.NODE_ENV === "production") return null;
  if (!Number.isSafeInteger(id) || id <= 0) return null;
  const url = geocodingUrl("get", apiKey);
  url.searchParams.set("id", String(id));
  const response = await fetch(url, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  return parseWeatherCity(await response.json());
}

type OpenMeteoResponse = {
  daily?: {
    time?: unknown;
    weather_code?: unknown;
    temperature_2m_max?: unknown;
    temperature_2m_min?: unknown;
    precipitation_probability_max?: unknown;
  };
};

function numericArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.length >= 7 &&
    value.slice(0, 7).every((item) => typeof item === "number" && Number.isFinite(item));
}

export function parseSevenDayForecast(value: unknown): ForecastDay[] | null {
  if (!value || typeof value !== "object") return null;
  const daily = (value as OpenMeteoResponse).daily;
  if (!daily || !Array.isArray(daily.time) || daily.time.length < 7 ||
      !daily.time.slice(0, 7).every((date: unknown) => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date)) ||
      !numericArray(daily.weather_code) || !numericArray(daily.temperature_2m_max) ||
      !numericArray(daily.temperature_2m_min)) return null;

  const rain = Array.isArray(daily.precipitation_probability_max)
    ? daily.precipitation_probability_max : [];
  const codes = daily.weather_code as number[];
  const highs = daily.temperature_2m_max as number[];
  const lows = daily.temperature_2m_min as number[];
  return daily.time.slice(0, 7).map((date: string, index: number) => ({
    date,
    code: codes[index],
    high: highs[index],
    low: lows[index],
    rainChance: typeof rain[index] === "number" && Number.isFinite(rain[index])
      ? rain[index] as number : null,
  }));
}

export function locationSearchTerm(address: string) {
  const parts = address.trim().split(",").map((part) => part.trim()).filter(Boolean);
  const withoutPostalCode = (part: string) => part.replace(/\s+\d{5}(?:-\d{4})?\s*$/, "").trim();
  if (parts.length >= 3) return `${parts[parts.length - 2]}, ${withoutPostalCode(parts[parts.length - 1])}`;
  if (parts.length === 2 && /^\d/.test(parts[0])) {
    const match = parts[1].match(/^(.+?)\s+([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/i);
    return match ? `${match[1]}, ${match[2]}` : withoutPostalCode(parts[1]);
  }
  if (parts.length === 2) return `${parts[0]}, ${withoutPostalCode(parts[1])}`;
  const postalCode = address.match(/\b\d{5}(?:-\d{4})?\b/);
  return postalCode?.[0] ?? address.trim();
}

async function geocodeAddress(address: string, apiKey: string | undefined) {
  const term = locationSearchTerm(address);
  if (term.length < 2) return null;
  const url = new URL(apiKey
    ? "https://customer-geocoding-api.open-meteo.com/v1/search"
    : "https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", term);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  if (apiKey) url.searchParams.set("apikey", apiKey);
  const response = await fetch(url, {
    next: { revalidate: 86_400 },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) return null;
  const result = await response.json() as {
    results?: Array<{ name?: string; admin1?: string; latitude?: number; longitude?: number }>;
  };
  const place = result.results?.[0];
  if (typeof place?.latitude !== "number" || !Number.isFinite(place.latitude) ||
      typeof place.longitude !== "number" || !Number.isFinite(place.longitude)) return null;
  const location = [place.name, place.admin1].filter(Boolean).join(", ") || term;
  return { latitude: place.latitude, longitude: place.longitude, location };
}

export async function getSevenDayForecast(addresses: string[], cityId?: number): Promise<SevenDayForecast | null> {
  const apiKey = process.env.OPEN_METEO_API_KEY?.trim();
  // Open-Meteo's public endpoint is for local development and evaluation.
  if (!apiKey && process.env.NODE_ENV === "production") return null;

  const selectedCity = cityId ? await getWeatherCity(cityId).catch(() => null) : null;
  let coordinates: Awaited<ReturnType<typeof geocodeAddress>> = selectedCity
    ? { latitude: selectedCity.latitude, longitude: selectedCity.longitude,
        location: [selectedCity.name, selectedCity.admin1, selectedCity.country].filter(Boolean).join(", ") }
    : null;
  for (const address of (cityId ? [] : addresses.filter(Boolean).slice(0, 3))) {
    try {
      coordinates = await geocodeAddress(address, apiKey);
      if (coordinates) break;
    } catch {
      // Try the next address when a company location cannot be resolved.
    }
  }
  if (!coordinates) return null;

  const url = new URL(apiKey
    ? "https://customer-api.open-meteo.com/v1/forecast"
    : "https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coordinates.latitude));
  url.searchParams.set("longitude", String(coordinates.longitude));
  url.searchParams.set("daily", "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max");
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("timezone", "auto");
  url.searchParams.set("forecast_days", "7");
  if (apiKey) url.searchParams.set("apikey", apiKey);

  try {
    const response = await fetch(url, {
      next: { revalidate: 3_600 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    const days = parseSevenDayForecast(await response.json());
    return days ? { location: coordinates.location, days } : null;
  } catch {
    return null;
  }
}
