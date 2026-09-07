"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ExternalLink, MapPin, RotateCw } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  getProjectMapAddress,
  getProjectStreetTitle,
} from "@/components/projects/project-location";
import type { MapLocationResponse } from "@/lib/maps/google-maps";
import { buildMapboxStaticImageUrl } from "@/lib/maps/mapbox";

type GeocodeState = "idle" | "loading" | "found" | "not-found" | "error";

type ProjectCoordinates = {
  lat: number;
  lng: number;
};

type ProjectMapCardProps = {
  address: string;
  city?: string | null;
  mapboxToken: string;
  state?: string | null;
};

export function ProjectMapCard({
  address,
  city,
  mapboxToken,
  state: projectState,
}: ProjectMapCardProps) {
  const [state, setState] = useState<GeocodeState>("idle");
  const [status, setStatus] = useState<string | null>(null);
  const [mapQuery, setMapQuery] = useState("");
  const [coordinates, setCoordinates] = useState<ProjectCoordinates | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const projectLocation = {
    project_address: address,
    project_city: city,
    project_state: projectState,
  };
  const streetAddress = getProjectStreetTitle(projectLocation);
  // Geocoding intentionally receives only the street number and street name.
  // City, state, and subdivision are excluded from the Google Maps API request.
  const geocodeAddress = streetAddress.trim();
  const normalizedAddress = getProjectMapAddress(projectLocation);

  const directionsUrl = useMemo(() => {
    const url = new URL("https://www.google.com/maps/dir/");
    url.searchParams.set("api", "1");
    url.searchParams.set("destination", mapQuery || normalizedAddress);
    return url.toString();
  }, [mapQuery, normalizedAddress]);

  const mapImageUrl = useMemo(() => {
    if (!coordinates) return "";
    return buildMapboxStaticImageUrl({
      accessToken: mapboxToken,
      markers: [{ ...coordinates, color: "2563eb", label: "1" }],
      width: 720,
      height: 540,
      zoom: 18,
    });
  }, [coordinates, mapboxToken]);

  useEffect(() => {
    const controller = new AbortController();

    async function findCurrentProjectAddress() {
      if (!geocodeAddress) {
        setStatus("INVALID_REQUEST");
        setMapQuery("");
        setCoordinates(null);
        setState("not-found");
        setDialogOpen(true);
        return;
      }

      if (!mapboxToken) {
        setStatus("MAPBOX_CONFIGURATION_ERROR");
        setMapQuery("");
        setCoordinates(null);
        setState("error");
        setDialogOpen(true);
        return;
      }

      setState("loading");
      setStatus(null);
      setMapQuery("");
      setCoordinates(null);

      try {
        const params = new URLSearchParams({ address: geocodeAddress });

        const response = await fetch(`/api/maps/geocode?${params.toString()}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as MapLocationResponse;

        if (controller.signal.aborted) return;

        setStatus(payload.status);
        const googleCoordinates = payload.coordinates;
        if (
          response.ok &&
          payload.found &&
          payload.provider === "google-maps" &&
          typeof googleCoordinates?.lat === "number" &&
          typeof googleCoordinates.lng === "number"
        ) {
          // Mapbox only displays the coordinate Google resolves from the
          // project's current address; there is no manual override path.
          setMapQuery(payload.query?.trim() || geocodeAddress);
          setCoordinates(googleCoordinates);
          setState("found");
          return;
        }

        setMapQuery("");
        setCoordinates(null);
        setState(response.status >= 500 ? "error" : "not-found");
        setDialogOpen(true);
      } catch (error) {
        if (controller.signal.aborted) return;

        setStatus(error instanceof Error ? error.name : "NETWORK_ERROR");
        setMapQuery("");
        setCoordinates(null);
        setState("error");
        setDialogOpen(true);
      }
    }

    void findCurrentProjectAddress();
    return () => controller.abort();
  }, [geocodeAddress, mapboxToken, requestKey]);

  const isMapReady = state === "found" && Boolean(mapImageUrl);
  const modalTitle =
    status === "MAPBOX_CONFIGURATION_ERROR"
      ? "Mapbox is not configured"
      : status === "MAPBOX_IMAGE_ERROR"
        ? "Mapbox map could not load"
      : status === "CONFIGURATION_ERROR"
        ? "Google address search is not configured"
        : "Address Not Found";
  const modalDescription =
    status === "MAPBOX_CONFIGURATION_ERROR"
      ? "Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable project map views."
      : status === "MAPBOX_IMAGE_ERROR"
        ? "Mapbox could not deliver the satellite image. Check the access token and try again."
      : status === "CONFIGURATION_ERROR"
        ? "Add GOOGLE_MAPS_API_KEY to enable project address search."
        : `Google Maps could not find "${streetAddress}". Check the current project address and try again.`;

  function handleMapImageError() {
    setStatus("MAPBOX_IMAGE_ERROR");
    setState("error");
    setDialogOpen(true);
  }

  return (
    <>
      <Card className="min-w-0 flex flex-col gap-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Project Satellite Map</div>
            <div className="mt-1 text-xs text-muted-foreground">{streetAddress}</div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Retry map lookup"
            onClick={() => setRequestKey((current) => current + 1)}
          >
            <RotateCw className="size-4" />
          </Button>
        </div>

        <div className="relative flex aspect-[4/3] overflow-hidden rounded-md border bg-muted/40">
          {isMapReady ? (
            <Image
              unoptimized
              fill
              src={mapImageUrl}
              alt={`Satellite map for ${streetAddress}`}
              className="object-cover"
              sizes="(min-width: 1024px) 20rem, 100vw"
              onError={handleMapImageError}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <div className="max-w-60">
                {state === "loading" ? (
                  <RotateCw className="mx-auto size-6 animate-spin text-muted-foreground" />
                ) : state === "not-found" || state === "error" ? (
                  <AlertTriangle className="mx-auto size-6 text-destructive" />
                ) : (
                  <MapPin className="mx-auto size-6 text-muted-foreground" />
                )}
                <div className="mt-3 text-sm font-medium">
                  {state === "loading" ? "Finding address..." : "Map unavailable"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {state === "loading"
                    ? "Checking the current project address with Google Maps."
                    : "Use retry after updating the address or API key."}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
          <span className="text-xs text-muted-foreground">
            {status
              ? `Google search: ${status} · Mapbox satellite view`
              : "Mapbox satellite view"}
          </span>
          <Button asChild variant="outline" size="sm" disabled={!normalizedAddress}>
            <a href={directionsUrl} target="_blank" rel="noreferrer">
              Directions
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      </Card>

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia>
              <AlertTriangle className="text-destructive" />
            </AlertDialogMedia>
            <AlertDialogTitle>{modalTitle}</AlertDialogTitle>
            <AlertDialogDescription>{modalDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDialogOpen(false)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
