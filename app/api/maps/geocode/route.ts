import { NextResponse } from "next/server";
import {
  buildGoogleMapsAddressCandidates,
  buildGoogleMapsGeocodeUrl,
  buildGoogleMapsSubdivisionQuery,
  extractGoogleMapsLocationContext,
  getGoogleMapsApiKey,
  isGoogleMapsAddressFound,
  selectBestGoogleMapsAddressResult,
  type GoogleMapsGeocodeResponse,
} from "@/lib/maps/google-maps";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const address = searchParams.get("address")?.trim() ?? "";
  const subdivision = searchParams.get("subdivision")?.trim() ?? "";
  const apiKey = getGoogleMapsApiKey();
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { found: false, status: "UNAUTHORIZED", message: "Authentication is required." },
      { status: 401 },
    );
  }

  if (!address) {
    return NextResponse.json(
      { found: false, status: "INVALID_REQUEST", message: "Address is required." },
      { status: 400 },
    );
  }

  if (!apiKey) {
    return NextResponse.json(
      {
        found: false,
        status: "CONFIGURATION_ERROR",
        message: "Google Maps API key is not configured.",
      },
      { status: 503 },
    );
  }

  try {
    let locationContext = {};

    if (subdivision) {
      const subdivisionResponse = await fetch(
        buildGoogleMapsGeocodeUrl({
          address: buildGoogleMapsSubdivisionQuery(subdivision),
          apiKey,
        }),
        { cache: "no-store" },
      );

      if (!subdivisionResponse.ok) {
        return NextResponse.json(
          {
            found: false,
            mode: "none",
            query: address,
            status: "GOOGLE_MAPS_ERROR",
            message: "Google Maps could not validate this subdivision.",
          },
          { status: 502 },
        );
      }

      const subdivisionGeocode =
        (await subdivisionResponse.json()) as GoogleMapsGeocodeResponse;

      if (
        subdivisionGeocode.status !== "OK" &&
        subdivisionGeocode.status !== "ZERO_RESULTS"
      ) {
        return NextResponse.json(
          {
            found: false,
            mode: "none",
            query: address,
            status: subdivisionGeocode.status,
            message:
              subdivisionGeocode.error_message ??
              "Google Maps could not validate this subdivision.",
          },
          { status: 502 },
        );
      }

      locationContext = extractGoogleMapsLocationContext(subdivisionGeocode);
    }

    const candidates = buildGoogleMapsAddressCandidates(address, {
      subdivision,
      ...locationContext,
    });
    let lastGeocode: GoogleMapsGeocodeResponse | null = null;

    for (const candidate of candidates) {
      // Keep subdivision out of the geocode query so Google resolves the exact
      // project address; subdivision is used only to choose among returned places.
      const response = await fetch(
        buildGoogleMapsGeocodeUrl({ address: candidate, apiKey }),
        { cache: "no-store" },
      );

      if (!response.ok) {
        return NextResponse.json(
          {
            found: false,
            mode: "none",
            query: address,
            status: "GOOGLE_MAPS_ERROR",
            message: "Google Maps could not validate this address.",
          },
          { status: 502 },
        );
      }

      const geocode = (await response.json()) as GoogleMapsGeocodeResponse;
      lastGeocode = geocode;

      if (isGoogleMapsAddressFound(geocode)) {
        const result = selectBestGoogleMapsAddressResult(geocode, {
          address: candidate,
          subdivision,
        });

        if (!result) {
          continue;
        }

        const lat = result.geometry?.location?.lat;
        const lng = result.geometry?.location?.lng;
        if (
          typeof lat !== "number" ||
          !Number.isFinite(lat) ||
          typeof lng !== "number" ||
          !Number.isFinite(lng)
        ) {
          continue;
        }

        return NextResponse.json({
          found: true,
          provider: "google-maps",
          mode: "place",
          query: candidate,
          placeId: result?.place_id ?? null,
          // This object is the explicit Google-to-Mapbox handoff contract.
          coordinates: { lat, lng },
          lat,
          lng,
          status: geocode.status,
          message: geocode.error_message ?? null,
        });
      }
    }

    if (
      lastGeocode &&
      lastGeocode.status !== "ZERO_RESULTS" &&
      lastGeocode.status !== "OK"
    ) {
      return NextResponse.json(
        {
          found: false,
          mode: "none",
          query: address,
          status: lastGeocode.status,
          message:
            lastGeocode.error_message ??
            "Google Maps could not validate this address.",
        },
        { status: 502 },
      );
    }

    return NextResponse.json(
      {
        found: false,
        mode: "none",
        query: candidates[0] ?? address,
        placeId: null,
        lat: null,
        lng: null,
        status: lastGeocode?.status ?? "ZERO_RESULTS",
        message:
          lastGeocode?.error_message ??
          "Google Maps could not find this address or subdivision.",
      },
      { status: 404 },
    );
  } catch {
    return NextResponse.json(
      {
        found: false,
        mode: "none",
        query: address,
        status: "NETWORK_ERROR",
        message: "Google Maps could not validate this address.",
      },
      { status: 502 },
    );
  }
}
