"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BriefcaseBusiness, CalendarDays, MapPin, RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  getProjectLocationSubtitle,
  getProjectMapAddress,
  getProjectStreetTitle,
} from "@/components/projects/project-location";
import {
  buildMapboxStaticImageUrl,
  MAPBOX_STYLE_URL,
} from "@/lib/maps/mapbox";
import type { MapLocationResponse } from "@/lib/maps/google-maps";

export type JobsMapJob = {
  id: string;
  title: string;
  scheduled_completion: string | null;
  is_completed: boolean;
  superintendent: string | null;
  price_cents: number | null;
};

export type JobsMapProject = {
  id: string;
  project_address: string;
  project_city: string | null;
  project_state: string | null;
  builder_name: string | null;
  subdivision: string | null;
  jobs: JobsMapJob[];
};

type LocatedProject = JobsMapProject & {
  lat: number;
  lng: number;
  mapQuery: string;
};

type LocatedJob = JobsMapJob & {
  project: JobsMapProject;
  lat: number;
  lng: number;
  pinLat: number;
  pinLng: number;
  pinIndex: number;
};

type MapboxMapInstance = {
  fitBounds: (
    bounds: [[number, number], [number, number]],
    options?: Record<string, unknown>,
  ) => void;
  flyTo: (options: Record<string, unknown>) => void;
  loaded?: () => boolean;
  off?: (event: string, handler: (...args: unknown[]) => void) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  remove: () => void;
  resize: () => void;
};

type MapboxMarkerInstance = {
  setLngLat: (position: [number, number]) => MapboxMarkerInstance;
  addTo: (map: MapboxMapInstance) => MapboxMarkerInstance;
  remove: () => void;
};

type MapboxRuntime = {
  accessToken: string;
  Map: new (
    options: Record<string, unknown>,
  ) => MapboxMapInstance;
  Marker: new (options: Record<string, unknown>) => MapboxMarkerInstance;
};

declare global {
  interface Window {
    mapboxgl?: MapboxRuntime;
  }
}

let mapboxScriptPromise: Promise<void> | null = null;

function loadMapboxScript(accessToken: string) {
  if (window.mapboxgl) {
    window.mapboxgl.accessToken = accessToken;
    return Promise.resolve();
  }
  if (mapboxScriptPromise) return mapboxScriptPromise;

  mapboxScriptPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("jobsyte-mapbox-css")) {
      const link = document.createElement("link");
      link.id = "jobsyte-mapbox-css";
      link.rel = "stylesheet";
      link.href = "https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.css";
      document.head.appendChild(link);
    }

    const existing = document.getElementById("jobsyte-mapbox-script");
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.mapboxgl) window.mapboxgl.accessToken = accessToken;
        resolve();
      }, { once: true });
      existing.addEventListener("error", () => reject(new Error("Mapbox failed to load.")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.id = "jobsyte-mapbox-script";
    script.src = "https://api.mapbox.com/mapbox-gl-js/v3.10.0/mapbox-gl.js";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.mapboxgl) window.mapboxgl.accessToken = accessToken;
      resolve();
    };
    script.onerror = () => reject(new Error("Mapbox failed to load."));
    document.head.appendChild(script);
  });

  return mapboxScriptPromise;
}

function formatMoney(cents: number | null) {
  if (typeof cents !== "number") return "No price";
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function formatDate(value: string | null) {
  if (!value) return "Unscheduled";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function projectOpenJobCount(project: JobsMapProject) {
  return project.jobs.filter((job) => !job.is_completed).length;
}

async function geocodeProject(project: JobsMapProject): Promise<LocatedProject | null> {
  const address = getProjectMapAddress(project);
  if (!address) return null;

  const params = new URLSearchParams({ address });
  if (project.subdivision?.trim()) {
    params.set("subdivision", project.subdivision.trim());
  }

  const response = await fetch(`/api/maps/geocode?${params.toString()}`);
  if (!response.ok) return null;

  const payload = (await response.json()) as MapLocationResponse;
  const googleCoordinates = payload.coordinates;
  if (
    !payload.found ||
    payload.provider !== "google-maps" ||
    typeof googleCoordinates?.lat !== "number" ||
    typeof googleCoordinates.lng !== "number"
  ) {
    return null;
  }

  return {
    ...project,
    // Every Mapbox job pin originates from Google's verified coordinates.
    lat: googleCoordinates.lat,
    lng: googleCoordinates.lng,
    mapQuery: payload.query?.trim() || address,
  };
}

function offsetJobPin({
  lat,
  lng,
  index,
  count,
}: {
  lat: number;
  lng: number;
  index: number;
  count: number;
}) {
  if (count <= 1) return { pinLat: lat, pinLng: lng };

  const angle = (Math.PI * 2 * index) / count;
  const radius = Math.min(0.00008 + count * 0.00001, 0.00018);
  const longitudeScale = Math.max(Math.cos((lat * Math.PI) / 180), 0.2);

  // Spread jobs at the same project address by a few meters so every Mapbox
  // marker remains clickable without changing the actual geocoded location.
  return {
    pinLat: lat + Math.sin(angle) * radius,
    pinLng: lng + (Math.cos(angle) * radius) / longitudeScale,
  };
}

function buildLocatedJobs(projects: LocatedProject[]) {
  let globalPinIndex = 0;

  return projects.flatMap((project) =>
    project.jobs.map<LocatedJob>((job, index) => {
      const { pinLat, pinLng } = offsetJobPin({
        lat: project.lat,
        lng: project.lng,
        index,
        count: project.jobs.length,
      });

      return {
        ...job,
        project,
        lat: project.lat,
        lng: project.lng,
        pinLat,
        pinLng,
        pinIndex: globalPinIndex++,
      };
    }),
  );
}

function getJobMarkerClassName(job: LocatedJob, isSelected: boolean) {
  const baseClassName =
    "flex h-9 min-w-9 items-center justify-center rounded-full border-2 border-white px-2 text-xs font-bold shadow-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const statusClassName = job.is_completed
    ? "bg-muted text-muted-foreground"
    : "bg-primary text-primary-foreground";
  const selectedClassName = isSelected
    ? "ring-2 ring-ring ring-offset-2 ring-offset-background"
    : job.is_completed
      ? "hover:bg-muted/80"
      : "hover:bg-primary/90";

  return `${baseClassName} ${statusClassName} ${selectedClassName}`;
}

function JobOverview({
  job,
}: {
  job: LocatedJob | null;
}) {
  if (!job) {
    return (
      <Empty className="min-h-64 border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <MapPin className="size-5" />
          </EmptyMedia>
          <EmptyTitle>Select a job pin</EmptyTitle>
          <EmptyDescription>
            Click a Mapbox pin to review the job and open its project page.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const project = job.project;
  const locationSubtitle = getProjectLocationSubtitle(project);
  const openJobs = projectOpenJobCount(project);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>{job.title}</CardTitle>
        <CardDescription>
          {[getProjectStreetTitle(project), locationSubtitle, project.builder_name]
            .filter(Boolean)
            .join(" • ")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border p-3">
            <div className="text-2xl font-semibold">{project.jobs.length}</div>
            <div className="text-xs text-muted-foreground">Total jobs</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-2xl font-semibold">{openJobs}</div>
            <div className="text-xs text-muted-foreground">Open jobs</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Selected job</div>
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant={job.is_completed ? "secondary" : "default"}>
                {job.is_completed ? "Completed" : "Open"}
              </Badge>
              <Badge variant="outline">{formatDate(job.scheduled_completion)}</Badge>
              <Badge variant="outline">{formatMoney(job.price_cents)}</Badge>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              {job.superintendent
                ? `Superintendent: ${job.superintendent}`
                : "No superintendent assigned"}
            </div>
          </div>
        </div>

        <Button asChild className="w-full">
          <Link href={`/projects/${project.id}`}>
            View Project
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function JobsMapPageClient({
  projects,
  mapboxToken,
}: {
  projects: JobsMapProject[];
  mapboxToken: string;
}) {
  const mapElementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMapInstance | null>(null);
  const markersRef = useRef<Map<string, MapboxMarkerInstance>>(new Map());
  const markerElementsRef = useRef<Map<string, HTMLButtonElement>>(new Map());
  const locatedJobsByIdRef = useRef<Map<string, LocatedJob>>(new Map());
  const [locatedProjects, setLocatedProjects] = useState<LocatedProject[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isPreparingMap, setIsPreparingMap] = useState(false);
  const [isInteractiveMapLoaded, setIsInteractiveMapLoaded] = useState(false);
  const [isMapboxRuntimeReady, setIsMapboxRuntimeReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapboxRuntimeError, setMapboxRuntimeError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const locatedJobs = useMemo(() => buildLocatedJobs(locatedProjects), [locatedProjects]);

  const selectedJob = useMemo(() => {
    return locatedJobs.find((job) => job.id === selectedJobId) ?? locatedJobs[0] ?? null;
  }, [locatedJobs, selectedJobId]);

  const staticMapUrl = useMemo(() => {
    return buildMapboxStaticImageUrl({
      accessToken: mapboxToken,
      markers: locatedJobs.map((job) => ({
        lat: job.pinLat,
        lng: job.pinLng,
        label: job.pinIndex + 1,
        color: job.is_completed ? "64748b" : "2563eb",
      })),
      width: 1280,
      height: 820,
      zoom: 13,
    });
  }, [locatedJobs, mapboxToken]);

  useEffect(() => {
    if (projects.length === 0) {
      setLocatedProjects([]);
      setSelectedJobId(null);
      setIsPreparingMap(false);
      setError(null);
      setMapboxRuntimeError(null);
      setIsInteractiveMapLoaded(false);
      setIsMapboxRuntimeReady(Boolean(window.mapboxgl));
      return;
    }

    if (!mapboxToken) {
      setError("Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to enable the jobs map view.");
      setLocatedProjects([]);
      setSelectedJobId(null);
      setIsPreparingMap(false);
      setMapboxRuntimeError(null);
      setIsInteractiveMapLoaded(false);
      setIsMapboxRuntimeReady(false);
      return;
    }

    let isActive = true;
    setIsPreparingMap(true);
    setError(null);
    setIsInteractiveMapLoaded(Boolean(mapRef.current?.loaded?.()));
    setIsMapboxRuntimeReady(Boolean(window.mapboxgl));
    setMapboxRuntimeError(null);

    void loadMapboxScript(mapboxToken)
      .then(() => {
        if (!isActive) return;
        setIsMapboxRuntimeReady(true);
        setMapboxRuntimeError(null);
      })
      .catch((caught: unknown) => {
        if (!isActive) return;
        setIsMapboxRuntimeReady(false);
        setIsInteractiveMapLoaded(false);
        setMapboxRuntimeError(
          caught instanceof Error
            ? caught.message
            : "Mapbox interactive runtime failed to load.",
        );
      });

    (async () => {
      try {
        // Google resolves each exact project address once. The Mapbox GL
        // runtime loads separately so Mapbox Static can still render pins while
        // the interactive script/style finishes loading or is blocked.
        const geocoded = await Promise.all(
          projects.map((project) => geocodeProject(project)),
        );

        if (!isActive) return;

        const nextLocatedProjects = geocoded.filter(
          (project): project is LocatedProject => project !== null,
        );
        const nextLocatedJobs = buildLocatedJobs(nextLocatedProjects);
        setLocatedProjects(nextLocatedProjects);
        if (nextLocatedJobs.length === 0) {
          setMapboxRuntimeError(null);
          setIsInteractiveMapLoaded(false);
        }
        setSelectedJobId((current) =>
          current && nextLocatedJobs.some((job) => job.id === current)
            ? current
            : nextLocatedJobs[0]?.id ?? null,
        );
      } catch (caught) {
        if (!isActive) return;
        setError(caught instanceof Error ? caught.message : "Failed to prepare map.");
        setLocatedProjects([]);
      } finally {
        if (isActive) setIsPreparingMap(false);
      }
    })();

    return () => {
      isActive = false;
    };
  }, [mapboxToken, projects, refreshKey]);

  useEffect(() => {
    locatedJobsByIdRef.current = new Map(
      locatedJobs.map((job) => [job.id, job]),
    );

    if (locatedJobs.length === 0) {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current.clear();
      markerElementsRef.current.clear();
      setIsInteractiveMapLoaded(false);
      return;
    }

    const mapboxgl = window.mapboxgl;
    const mapElement = mapElementRef.current;
    if (!isMapboxRuntimeReady || !mapboxgl || !mapElement) return;

    const center = {
      lat:
        locatedJobs.reduce((sum, job) => sum + job.pinLat, 0) /
        locatedJobs.length,
      lng:
        locatedJobs.reduce((sum, job) => sum + job.pinLng, 0) /
        locatedJobs.length,
    };

    const map =
      mapRef.current ??
      new mapboxgl.Map({
        container: mapElement,
        style: MAPBOX_STYLE_URL,
        center: [center.lng, center.lat],
        zoom: 11,
      });
    mapRef.current = map;
    map.resize();

    let isActive = true;
    const handleMapLoaded = () => {
      if (!isActive) return;
      map.resize();
      setIsInteractiveMapLoaded(true);
      setMapboxRuntimeError(null);
    };
    const handleMapError = () => {
      if (!isActive) return;
      setIsInteractiveMapLoaded(false);
      setMapboxRuntimeError("Mapbox style failed to load.");
    };

    if (map.loaded?.()) {
      handleMapLoaded();
    } else {
      setIsInteractiveMapLoaded(false);
      map.on("load", handleMapLoaded);
      map.on("error", handleMapError);
    }

    const nextJobIds = new Set(locatedJobs.map((job) => job.id));
    markersRef.current.forEach((marker, jobId) => {
      if (!nextJobIds.has(jobId)) {
        marker.remove();
        markersRef.current.delete(jobId);
        markerElementsRef.current.delete(jobId);
      }
    });

    let minLat = Number.POSITIVE_INFINITY;
    let maxLat = Number.NEGATIVE_INFINITY;
    let minLng = Number.POSITIVE_INFINITY;
    let maxLng = Number.NEGATIVE_INFINITY;

    for (const job of locatedJobs) {
      const position = { lat: job.pinLat, lng: job.pinLng };
      minLat = Math.min(minLat, position.lat);
      maxLat = Math.max(maxLat, position.lat);
      minLng = Math.min(minLng, position.lng);
      maxLng = Math.max(maxLng, position.lng);

      const existingMarker = markersRef.current.get(job.id);
      const existingElement = markerElementsRef.current.get(job.id);
      if (existingMarker && existingElement) {
        existingMarker.setLngLat([position.lng, position.lat]);
        existingElement.textContent = String(job.pinIndex + 1);
        existingElement.className = getJobMarkerClassName(job, false);
        existingElement.style.zIndex = "";
        existingElement.setAttribute(
          "aria-label",
          `Open job ${job.title} at ${getProjectStreetTitle(job.project)}`,
        );
        continue;
      }

      const markerElement = document.createElement("button");
      markerElement.type = "button";
      markerElement.className = getJobMarkerClassName(job, false);
      markerElement.textContent = String(job.pinIndex + 1);
      markerElement.style.zIndex = "";
      markerElement.setAttribute(
        "aria-label",
        `Open job ${job.title} at ${getProjectStreetTitle(job.project)}`,
      );
      markerElement.addEventListener("click", () => {
        const currentJob = locatedJobsByIdRef.current.get(job.id);
        if (!currentJob) return;

        setSelectedJobId(currentJob.id);
        map.flyTo({
          center: [currentJob.pinLng, currentJob.pinLat],
          zoom: 15,
          duration: 500,
          essential: true,
        });
      });

      const marker = new mapboxgl.Marker({ element: markerElement, anchor: "bottom" })
        .setLngLat([position.lng, position.lat])
        .addTo(map);

      markersRef.current.set(job.id, marker);
      markerElementsRef.current.set(job.id, markerElement);
    }

    if (locatedJobs.length === 1) {
      map.flyTo({
        center: [center.lng, center.lat],
        zoom: 15,
        essential: true,
      });
    } else {
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 80, maxZoom: 15 },
      );
    }

    return () => {
      isActive = false;
      map.off?.("load", handleMapLoaded);
      map.off?.("error", handleMapError);
    };
  }, [isMapboxRuntimeReady, locatedJobs]);

  useEffect(() => {
    for (const job of locatedJobs) {
      const markerElement = markerElementsRef.current.get(job.id);
      if (!markerElement) continue;

      const isSelected = selectedJob?.id === job.id;
      markerElement.className = getJobMarkerClassName(job, isSelected);
      markerElement.style.zIndex = isSelected ? "2" : "";
      markerElement.setAttribute(
        "aria-pressed",
        isSelected ? "true" : "false",
      );
    }
  }, [locatedJobs, selectedJob?.id]);

  useEffect(() => {
    const markers = markersRef.current;
    const markerElements = markerElementsRef.current;
    const locatedJobsById = locatedJobsByIdRef.current;

    return () => {
      markers.forEach((marker) => marker.remove());
      markers.clear();
      markerElements.clear();
      locatedJobsById.clear();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const totalJobCount = projects.reduce((sum, project) => sum + project.jobs.length, 0);
  const unpinnedCount = Math.max(totalJobCount - locatedJobs.length, 0);
  const shouldShowStaticMap =
    Boolean(staticMapUrl) &&
    locatedJobs.length > 0 &&
    (!isMapboxRuntimeReady ||
      !isInteractiveMapLoaded ||
      Boolean(mapboxRuntimeError));

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Map</h1>
          <p className="text-sm text-muted-foreground">
            Job locations rendered with Mapbox pins.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full gap-2 sm:w-auto"
          onClick={() => setRefreshKey((current) => current + 1)}
          disabled={isPreparingMap || projects.length === 0}
        >
          <RotateCw className="size-4" />
          Refresh Pins
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card className="min-h-[70vh] p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <BriefcaseBusiness className="size-3" />
                {totalJobCount} jobs
              </Badge>
              <Badge variant="outline" className="gap-1">
                <MapPin className="size-3" />
                {locatedJobs.length} pinned
              </Badge>
              {unpinnedCount > 0 ? (
                <Badge variant="outline">{unpinnedCount} unpinned</Badge>
              ) : null}
            </div>
            {isPreparingMap ? (
              <div className="text-sm text-muted-foreground">Preparing pins...</div>
            ) : shouldShowStaticMap ? (
              <div className="text-sm text-muted-foreground">
                Showing Mapbox satellite static view
              </div>
            ) : null}
          </div>

          <div className="relative min-h-[calc(70vh-3.25rem)]">
            <div
              ref={mapElementRef}
              className={
                error ||
                projects.length === 0 ||
                (locatedJobs.length === 0 && !isPreparingMap)
                  ? "hidden"
                  : `absolute inset-0 ${isInteractiveMapLoaded ? "" : "opacity-0"}`
              }
            />
            {shouldShowStaticMap ? (
              <div
                role="img"
                aria-label="Mapbox static map showing job locations"
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${staticMapUrl})` }}
              />
            ) : null}
            {isPreparingMap && locatedJobs.length === 0 && !error ? (
              <div className="absolute inset-4 flex items-center justify-center rounded-lg border bg-background/80 p-6 text-center text-sm text-muted-foreground">
                Preparing Google address search and Mapbox pins...
              </div>
            ) : null}
            {projects.length === 0 ? (
              <Empty className="absolute inset-4 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <CalendarDays className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No jobs to map</EmptyTitle>
                  <EmptyDescription>
                    Add jobs to projects before opening the map.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : error ? (
              <Empty className="absolute inset-4 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MapPin className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>Map unavailable</EmptyTitle>
                  <EmptyDescription>{error}</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : locatedJobs.length === 0 && !isPreparingMap ? (
              <Empty className="absolute inset-4 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <MapPin className="size-5" />
                  </EmptyMedia>
                  <EmptyTitle>No job addresses found</EmptyTitle>
                  <EmptyDescription>
                    Google address search could not resolve any current job addresses.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : null}
          </div>
        </Card>

        <JobOverview job={selectedJob} />
      </div>
    </div>
  );
}
