import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Droplets,
  Sun,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { getSevenDayForecast, type ForecastDay } from "@/lib/weather/open-meteo";

function weatherDetails(code: number) {
  if (code === 0) return { label: "Clear", Icon: Sun };
  if (code <= 2) return { label: "Partly cloudy", Icon: CloudSun };
  if (code === 3) return { label: "Cloudy", Icon: Cloud };
  if (code === 45 || code === 48) return { label: "Fog", Icon: CloudFog };
  if (code >= 51 && code <= 57) return { label: "Drizzle", Icon: CloudDrizzle };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { label: "Rain", Icon: CloudRain };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { label: "Snow", Icon: CloudSnow };
  if (code >= 95) return { label: "Storms", Icon: CloudLightning };
  return { label: "Cloudy", Icon: Cloud };
}

function ForecastRow({ day, index }: { day: ForecastDay; index: number }) {
  const { label, Icon } = weatherDetails(day.code);
  const date = new Date(`${day.date}T12:00:00Z`);
  const dayLabel = index === 0 ? "Today" : date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const dateLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

  return (
    <div className="grid min-h-16 grid-cols-[3.5rem_2rem_minmax(0,1fr)_auto] items-center gap-2 border-b border-border/70 px-4 py-2 last:border-b-0">
      <div className="leading-tight">
        <div className="text-xs font-semibold text-foreground">{dayLabel}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">{dateLabel}</div>
      </div>
      <Icon className="size-5 text-primary" aria-hidden="true" />
      <div className="min-w-0 leading-tight">
        <div className="truncate text-xs font-medium text-foreground">{label}</div>
        {day.rainChance !== null && (
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Droplets className="size-3" aria-hidden="true" />
            {Math.round(day.rainChance)}% rain
          </div>
        )}
      </div>
      <div className="whitespace-nowrap text-right text-xs tabular-nums">
        <span className="font-semibold text-foreground">{Math.round(day.high)}°</span>
        <span className="ml-1 text-muted-foreground">{Math.round(day.low)}°</span>
      </div>
    </div>
  );
}

export function WeatherForecastSkeleton() {
  return (
    <Card className="flex min-h-[30rem] min-w-0 flex-col gap-0 border-border py-0" aria-label="Loading weather forecast">
      <div className="border-b px-4 py-4">
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-24 animate-pulse rounded bg-muted" />
      </div>
      <div className="grid flex-1 grid-rows-7">
        {Array.from({ length: 7 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 border-b px-4 last:border-b-0">
            <div className="h-3 w-12 animate-pulse rounded bg-muted" />
            <div className="h-5 w-5 animate-pulse rounded bg-muted" />
            <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    </Card>
  );
}

export async function SevenDayWeather({ addresses, cityId }: { addresses: string[]; cityId?: number }) {
  const forecast = await getSevenDayForecast(addresses, cityId);
  const message = process.env.NODE_ENV === "production" && !process.env.OPEN_METEO_API_KEY
      ? "Configure an Open-Meteo API key to show the forecast."
      : addresses.length === 0 && !cityId
        ? "Choose a city in Settings to see the local forecast."
        : "Forecast unavailable right now.";

  return (
    <Card className="flex min-h-[30rem] min-w-0 flex-col gap-0 border-border py-0">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-4">
        <div className="min-w-0">
          <h2 className="font-semibold text-foreground">7-Day Weather</h2>
          <p className="truncate text-xs text-muted-foreground">{forecast?.location ?? "Local forecast"}</p>
        </div>
        <CloudSun className="size-5 shrink-0 text-primary" aria-hidden="true" />
      </div>
      {forecast ? (
        <div className="grid min-h-0 flex-1 grid-rows-7">
          {forecast.days.map((day, index) => <ForecastRow key={day.date} day={day} index={index} />)}
        </div>
      ) : (
        <p className="flex flex-1 items-center justify-center px-6 py-8 text-center text-sm text-muted-foreground">{message}</p>
      )}
      <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Forecast by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">Open-Meteo</a>
      </div>
    </Card>
  );
}
