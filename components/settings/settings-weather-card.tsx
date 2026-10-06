"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudSun, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { searchWeatherCities, updateWeatherCity } from "@/app/(jobsyte-app)/settings/actions";
import type { WeatherCity } from "@/lib/weather/open-meteo";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SettingsWeatherCard({ initialCityName }: { initialCityName?: string }) {
  const router = useRouter();
  const [cityName, setCityName] = useState(initialCityName);
  const [query, setQuery] = useState("");
  const [cities, setCities] = useState<WeatherCity[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [saving, setSaving] = useState(false);

  async function onSearch() {
    if (query.trim().length < 2) return;
    setSearching(true);
    setCities([]);
    setSearched(false);
    const result = await searchWeatherCities(query);
    setSearching(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setCities(result.cities);
    setSearched(true);
  }

  async function onSelect(city: WeatherCity | null) {
    setSaving(true);
    const result = await updateWeatherCity(city?.id ?? null);
    setSaving(false);
    if (!result.ok) {
      toast.error(result.message);
      return;
    }
    setCityName(city ? [city.name, city.admin1, city.country].filter(Boolean).join(", ") : undefined);
    setCities([]);
    setQuery("");
    toast.success(result.message);
    router.refresh();
  }

  return (
    <Card className="min-w-0 gap-4 p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <CloudSun className="size-5 text-primary" aria-hidden="true" />
        Weather Location
      </div>
      <p className="text-sm text-muted-foreground">
        Choose a city for the seven-day forecast on your dashboard.
      </p>
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 p-3 text-sm">
        <MapPin className="size-4 shrink-0 text-primary" aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{cityName ?? "Automatic from company or project address"}</span>
        {cityName && (
          <Button type="button" variant="ghost" size="sm" disabled={saving} onClick={() => onSelect(null)}>
            Use automatic
          </Button>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="weather-city-search">Search cities</Label>
        <form onSubmit={(event) => { event.preventDefault(); void onSearch(); }} className="flex min-w-0 gap-2">
          <Input
            id="weather-city-search"
            className="min-w-0 flex-1"
            value={query}
            onChange={(event) => { setQuery(event.target.value); setCities([]); setSearched(false); }}
            placeholder="City, state or country"
            maxLength={100}
            autoComplete="off"
            disabled={searching || saving}
          />
          <Button type="submit" variant="outline" disabled={searching || saving || query.trim().length < 2}>
            <Search className="size-4" aria-hidden="true" />
            {searching ? "Searching" : "Search"}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">For example, Katy, TX or London, UK.</p>
      </div>
      {cities.length > 0 && (
        <div className="space-y-1" aria-label="Matching cities">
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              disabled={saving}
              onClick={() => onSelect(city)}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              {[city.name, city.admin1, city.country].filter(Boolean).join(", ")}
            </button>
          ))}
        </div>
      )}
      {searched && cities.length === 0 && (
        <p className="text-sm text-muted-foreground">No matching cities found. Try a city with its state or country.</p>
      )}
      <p className="text-xs text-muted-foreground">
        Location data by <a href="https://www.geonames.org/" target="_blank" rel="noreferrer" className="underline underline-offset-2">GeoNames</a> via Open-Meteo.
      </p>
    </Card>
  );
}
