export type GoogleMapsEnv = {
  [key: string]: string | undefined;
  GOOGLE_MAPS_API_KEY?: string;
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?: string;
};

export type GoogleMapsGeocodeResult = {
  place_id?: string;
  formatted_address?: string;
  types?: string[];
  geometry?: {
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  address_components?: Array<{
    long_name?: string;
    short_name?: string;
    types?: string[];
  }>;
};

export type GoogleMapsGeocodeResponse = {
  status: string;
  results?: GoogleMapsGeocodeResult[];
  error_message?: string;
};

export type MapLocationResponse = {
  found: boolean;
  provider?: "google-maps";
  query?: string;
  coordinates?: { lat: number; lng: number } | null;
  status: string;
  message?: string | null;
};

type GoogleMapsUrlInput = {
  address: string;
  apiKey: string;
};

type GoogleMapsPlaceIdUrlInput = {
  placeId: string;
  apiKey: string;
};

type GoogleMapsAddressContext = {
  address?: string | null;
  subdivision?: string | null;
  locality?: string | null;
  administrativeArea?: string | null;
  country?: string | null;
};

function normalizeAddressQuery(address: string) {
  return address.trim().replace(/\s+/g, " ");
}

function stripLotAndUnitFragments(address: string) {
  return normalizeAddressQuery(address)
    .replace(/^(?:lot|unit|suite|ste|apt|apartment|#)\s*[\w-]+\s*[-,]?\s*/i, "")
    .replace(/\s+(?:unit|suite|ste|apt|apartment|#)\s*[\w-]+(?=,|$)/gi, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+-\s+/g, " ")
    .trim();
}

function getAddressComponent(
  result: GoogleMapsGeocodeResult | null,
  types: string[],
  name: "long_name" | "short_name" = "long_name",
) {
  return (
    result?.address_components?.find((component) =>
      types.every((type) => component.types?.includes(type)),
    )?.[name] ?? ""
  );
}

function buildLocationQualifiedAddress(
  address: string,
  context: GoogleMapsAddressContext,
) {
  const locality = normalizeAddressQuery(context.locality ?? "");
  const administrativeArea = normalizeAddressQuery(
    context.administrativeArea ?? "",
  );

  if (!locality && !administrativeArea) return "";

  return [address, locality, administrativeArea].filter(Boolean).join(", ");
}

export function getGoogleMapsApiKey(env: GoogleMapsEnv = process.env) {
  return (
    env.GOOGLE_MAPS_API_KEY?.trim() ||
    env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

export function buildGoogleMapsGeocodeUrl({
  address,
  apiKey,
}: GoogleMapsUrlInput) {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("key", apiKey);
  return url;
}

export function buildGoogleMapsSubdivisionQuery(subdivision: string) {
  const normalizedSubdivision = normalizeAddressQuery(subdivision);
  return normalizedSubdivision ? `${normalizedSubdivision} subdivision` : "";
}

export function buildGoogleMapsAddressCandidates(
  address: string,
  context: GoogleMapsAddressContext = {},
) {
  const normalizedAddress = normalizeAddressQuery(address);
  const strippedAddress = stripLotAndUnitFragments(address);
  const baseCandidates = [normalizedAddress, strippedAddress].filter(Boolean);
  const locationCandidates = baseCandidates
    .map((candidate) => buildLocationQualifiedAddress(candidate, context))
    .filter(Boolean);

  return Array.from(new Set([...locationCandidates, ...baseCandidates]));
}

export function buildGoogleMapsEmbedUrl({
  address,
  apiKey,
}: GoogleMapsUrlInput) {
  const url = new URL("https://www.google.com/maps/embed/v1/place");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", address);
  return url.toString();
}

export function buildGoogleMapsPlaceIdEmbedUrl({
  placeId,
  apiKey,
}: GoogleMapsPlaceIdUrlInput) {
  const url = new URL("https://www.google.com/maps/embed/v1/place");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", `place_id:${placeId}`);
  return url.toString();
}

export function buildGoogleMapsSearchEmbedUrl({
  address,
  apiKey,
}: GoogleMapsUrlInput) {
  const url = new URL("https://www.google.com/maps/embed/v1/search");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", address);
  return url.toString();
}

export function isGoogleMapsAddressFound(response: GoogleMapsGeocodeResponse) {
  return response.status === "OK" && (response.results?.length ?? 0) > 0;
}

export function extractGoogleMapsLocationContext(
  response: GoogleMapsGeocodeResponse,
): GoogleMapsAddressContext {
  const result = response.results?.[0] ?? null;

  const locality =
    getAddressComponent(result, ["locality", "political"]) ||
    getAddressComponent(result, ["postal_town"]) ||
    getAddressComponent(result, ["sublocality", "political"]) ||
    getAddressComponent(result, ["administrative_area_level_3", "political"]);
  const administrativeArea = getAddressComponent(
    result,
    ["administrative_area_level_1", "political"],
    "short_name",
  );
  const country = getAddressComponent(result, ["country", "political"], "short_name");

  return {
    locality: locality || null,
    administrativeArea: administrativeArea || null,
    country: country || null,
  };
}

function normalizeMatchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeRouteText(value: string) {
  const replacements: Record<string, string> = {
    aly: "alley",
    ave: "avenue",
    blvd: "boulevard",
    cir: "circle",
    ct: "court",
    cv: "cove",
    dr: "drive",
    hwy: "highway",
    ln: "lane",
    lndg: "landing",
    pkwy: "parkway",
    pl: "place",
    rd: "road",
    sq: "square",
    st: "street",
    ter: "terrace",
    trl: "trail",
    way: "way",
  };

  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((part) => replacements[part] ?? part)
    .join(" ");
}

function parseStreetAddress(value: string) {
  const streetOnly = stripLotAndUnitFragments(value).split(",")[0] ?? "";
  const match = streetOnly.match(/^(\d+)\s+(.+)$/);
  if (!match) return null;

  return {
    streetNumber: match[1],
    route: normalizeRouteText(match[2]),
  };
}

function resultIncludesSubdivision(
  result: GoogleMapsGeocodeResult,
  subdivision: string,
) {
  const needle = normalizeMatchText(subdivision);
  if (!needle) return false;

  const formattedAddress = normalizeMatchText(result.formatted_address ?? "");
  if (formattedAddress.includes(needle)) return true;

  return (result.address_components ?? []).some((component) => {
    const longName = normalizeMatchText(component.long_name ?? "");
    const shortName = normalizeMatchText(component.short_name ?? "");
    return longName === needle || shortName === needle;
  });
}

function resultHasAddressComponent(
  result: GoogleMapsGeocodeResult,
  types: string[],
) {
  return (result.address_components ?? []).some((component) =>
    types.every((type) => component.types?.includes(type)),
  );
}

function isStreetLevelGoogleMapsResult(result: GoogleMapsGeocodeResult) {
  const resultTypes = result.types ?? [];
  if (
    resultTypes.includes("street_address") ||
    resultTypes.includes("premise") ||
    resultTypes.includes("subpremise")
  ) {
    return true;
  }

  return (
    resultHasAddressComponent(result, ["route"]) &&
    (resultHasAddressComponent(result, ["street_number"]) ||
      resultHasAddressComponent(result, ["premise"]) ||
      resultHasAddressComponent(result, ["subpremise"]))
  );
}

function resultMatchesStreetAddress(
  result: GoogleMapsGeocodeResult,
  address: string,
) {
  const expected = parseStreetAddress(address);
  if (!expected) return false;

  const streetNumber = getAddressComponent(result, ["street_number"]);
  const route = getAddressComponent(result, ["route"]);

  if (!streetNumber || !route) return false;

  return (
    streetNumber === expected.streetNumber &&
    normalizeRouteText(route) === expected.route
  );
}

export function selectBestGoogleMapsResult(
  response: GoogleMapsGeocodeResponse,
  context: GoogleMapsAddressContext = {},
) {
  const results = response.results ?? [];
  if (results.length === 0) return null;

  const subdivision = normalizeAddressQuery(context.subdivision ?? "");
  if (!subdivision) return results[0];

  return (
    results.find((result) => resultIncludesSubdivision(result, subdivision)) ??
    results[0]
  );
}

export function selectBestGoogleMapsAddressResult(
  response: GoogleMapsGeocodeResponse,
  context: GoogleMapsAddressContext = {},
) {
  const expectedAddress = normalizeAddressQuery(context.address ?? "");
  const streetLevelResults = (response.results ?? []).filter(
    (result) =>
      isStreetLevelGoogleMapsResult(result) &&
      (!expectedAddress || resultMatchesStreetAddress(result, expectedAddress)),
  );

  if (streetLevelResults.length === 0) return null;

  return selectBestGoogleMapsResult(
    { ...response, results: streetLevelResults },
    context,
  );
}
