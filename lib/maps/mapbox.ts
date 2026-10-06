export type MapboxEnv = {
  [key: string]: string | undefined;
  MAPBOX_ACCESS_TOKEN?: string;
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?: string;
};

// Satellite Streets renders imagery consistently in both GL JS and Static Images.
export const MAPBOX_STYLE_ID = "satellite-streets-v12";
export const MAPBOX_STYLE_URL = `mapbox://styles/mapbox/${MAPBOX_STYLE_ID}`;

type MapboxMarker = {
  lat: number;
  lng: number;
  label?: string | number;
  color?: string;
};

type MapboxStaticImageInput = {
  accessToken: string;
  markers: MapboxMarker[];
  width?: number;
  height?: number;
  zoom?: number;
};

function clampCoordinate(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatCoordinate(value: number) {
  return String(Number(value.toFixed(6)));
}

function formatMarkerLabel(label: string | number | undefined) {
  const normalized = String(label ?? "")
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .slice(0, 2);

  return normalized || "1";
}

function formatMarkerColor(color: string | undefined) {
  return (color ?? "2563eb").replace(/[^a-f0-9]/gi, "").slice(0, 6) || "2563eb";
}

export function getMapboxAccessToken(env: MapboxEnv = process.env) {
  return (
    env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() ||
    env.MAPBOX_ACCESS_TOKEN?.trim() ||
    ""
  );
}

export function getPublicMapboxAccessToken(env: MapboxEnv = process.env) {
  return env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN?.trim() || "";
}

export function buildMapboxStaticImageUrl({
  accessToken,
  markers,
  width = 960,
  height = 720,
  zoom = 16,
}: MapboxStaticImageInput) {
  const validMarkers = markers.filter(
    (marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng),
  );

  if (!accessToken.trim() || validMarkers.length === 0) return "";

  const overlays = validMarkers
    .map((marker) => {
      const lat = formatCoordinate(clampCoordinate(marker.lat, -85.051129, 85.051129));
      const lng = formatCoordinate(clampCoordinate(marker.lng, -180, 180));
      const label = formatMarkerLabel(marker.label);
      const color = formatMarkerColor(marker.color);
      return `pin-s-${label}+${color}(${lng},${lat})`;
    })
    .join(",");

  const center =
    validMarkers.length === 1
      ? `${formatCoordinate(validMarkers[0].lng)},${formatCoordinate(
          validMarkers[0].lat,
        )},${zoom},0`
      : "auto";

  const url = new URL(
    `https://api.mapbox.com/styles/v1/mapbox/${MAPBOX_STYLE_ID}/static/${overlays}/${center}/${width}x${height}@2x`,
  );
  url.searchParams.set("access_token", accessToken.trim());
  if (validMarkers.length > 1) {
    url.searchParams.set("padding", "80,80,80,80");
  }

  return url.toString();
}
