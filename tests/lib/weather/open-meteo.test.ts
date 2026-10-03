import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSevenDayForecast,
  getWeatherCity,
  locationSearchTerm,
  parseSevenDayForecast,
  searchWeatherCities,
} from "@/lib/weather/open-meteo";

const daily = {
  time: Array.from({ length: 7 }, (_, index) => `2026-10-${String(index + 2).padStart(2, "0")}`),
  weather_code: [0, 2, 3, 61, 80, 71, 95],
  temperature_2m_max: [82, 80, 78, 75, 74, 70, 69],
  temperature_2m_min: [67, 66, 64, 63, 62, 59, 57],
  precipitation_probability_max: [0, 10, 20, 60, 70, 30, 80],
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Open-Meteo forecast", () => {
  it("extracts a city and state from a business address", () => {
    expect(locationSearchTerm("2065 Solstice Landing Dr, Katy, TX 77493")).toBe("Katy, TX");
    expect(locationSearchTerm("Katy, TX")).toBe("Katy, TX");
    expect(locationSearchTerm("123 Main St, Katy TX 77493")).toBe("Katy, TX");
  });

  it("validates all seven daily forecast values", () => {
    expect(parseSevenDayForecast({ daily })).toHaveLength(7);
    expect(parseSevenDayForecast({ daily: { ...daily, temperature_2m_max: [82] } })).toBeNull();
    expect(parseSevenDayForecast({ daily: { ...daily, weather_code: [null, ...daily.weather_code.slice(1)] } })).toBeNull();
  });

  it("uses geocoding and forecast endpoints in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPEN_METEO_API_KEY", "");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({
        results: [{ name: "Katy", admin1: "Texas", latitude: 29.7858, longitude: -95.8245 }],
      }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ daily }) });
    vi.stubGlobal("fetch", fetchMock);

    const forecast = await getSevenDayForecast(["2065 Solstice Landing Dr, Katy, TX 77493"]);

    expect(forecast).toEqual({ location: "Katy, Texas", days: expect.arrayContaining([
      expect.objectContaining({ date: "2026-10-02", high: 82, rainChance: 0 }),
    ]) });
    expect(String(fetchMock.mock.calls[0][0])).toContain("geocoding-api.open-meteo.com/v1/search?name=Katy%2C+TX");
    expect(String(fetchMock.mock.calls[1][0])).toContain("api.open-meteo.com/v1/forecast?");
    expect(String(fetchMock.mock.calls[1][0])).toContain("forecast_days=7");
  });

  it("requires the customer API key in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OPEN_METEO_API_KEY", "");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    expect(await getSevenDayForecast(["Katy, TX"])).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("searches cities and uses the selected city's coordinates", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OPEN_METEO_API_KEY", "");
    const city = { id: 4699066, name: "Katy", admin1: "Texas", country: "United States", latitude: 29.7858, longitude: -95.8245 };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ results: [city] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => city })
      .mockResolvedValueOnce({ ok: true, json: async () => city })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ daily }) });
    vi.stubGlobal("fetch", fetchMock);

    expect(await searchWeatherCities("Katy, TX")).toEqual([city]);
    expect(await getWeatherCity(city.id)).toEqual(city);
    const forecast = await getSevenDayForecast(["London, UK"], city.id);
    expect(forecast?.location).toBe("Katy, Texas, United States");
    expect(String(fetchMock.mock.calls[2][0])).toContain(`geocoding-api.open-meteo.com/v1/get?id=${city.id}`);
    expect(String(fetchMock.mock.calls[3][0])).toContain("latitude=29.7858");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});
