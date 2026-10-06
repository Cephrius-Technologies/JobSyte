import { describe, expect, it } from "vitest";
import {
  buildGoogleMapsAddressCandidates,
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsGeocodeUrl,
  buildGoogleMapsPlaceIdEmbedUrl,
  buildGoogleMapsSearchEmbedUrl,
  buildGoogleMapsSubdivisionQuery,
  extractGoogleMapsLocationContext,
  getGoogleMapsApiKey,
  isGoogleMapsAddressFound,
  selectBestGoogleMapsAddressResult,
  selectBestGoogleMapsResult,
} from "@/lib/maps/google-maps";

describe("google maps helpers", () => {
  it("returns the server Google Maps key before the public fallback", () => {
    const env = {
      GOOGLE_MAPS_API_KEY: " server-key ",
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: " public-key ",
    };

    expect(getGoogleMapsApiKey(env)).toBe("server-key");
  });

  it("uses the public Google Maps key when a server key is not configured", () => {
    const env = {
      NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: " public-key ",
    };

    expect(getGoogleMapsApiKey(env)).toBe("public-key");
  });

  it("builds a geocode URL with an encoded address and key", () => {
    const url = buildGoogleMapsGeocodeUrl({
      address: "101 Main St, Austin TX",
      apiKey: "abc123",
    });

    expect(url.toString()).toBe(
      "https://maps.googleapis.com/maps/api/geocode/json?address=101+Main+St%2C+Austin+TX&key=abc123",
    );
  });

  it("builds an embeddable map URL with the project address", () => {
    const url = buildGoogleMapsEmbedUrl({
      address: "101 Main St, Austin TX",
      apiKey: "abc123",
    });

    expect(url).toBe(
      "https://www.google.com/maps/embed/v1/place?key=abc123&q=101+Main+St%2C+Austin+TX",
    );
  });

  it("builds a Google Maps search embed URL for fuzzy fallback lookups", () => {
    const url = buildGoogleMapsSearchEmbedUrl({
      address: "101 Main St, Austin TX",
      apiKey: "abc123",
    });

    expect(url).toBe(
      "https://www.google.com/maps/embed/v1/search?key=abc123&q=101+Main+St%2C+Austin+TX",
    );
  });

  it("builds a subdivision lookup query for fallback map context", () => {
    expect(buildGoogleMapsSubdivisionQuery(" Hidden Lakes ")).toBe(
      "Hidden Lakes subdivision",
    );
  });

  it("builds a place-id embed URL for exact Google geocode results", () => {
    const url = buildGoogleMapsPlaceIdEmbedUrl({
      placeId: "ChIJ123",
      apiKey: "abc123",
    });

    expect(url).toBe(
      "https://www.google.com/maps/embed/v1/place?key=abc123&q=place_id%3AChIJ123",
    );
  });

  it("builds geocode candidates from normalized and lot/unit-stripped addresses", () => {
    expect(
      buildGoogleMapsAddressCandidates(
        " Lot 14 - 101 Main St Unit B, Austin, TX 78701 ",
      ),
    ).toEqual([
      "Lot 14 - 101 Main St Unit B, Austin, TX 78701",
      "101 Main St, Austin, TX 78701",
    ]);
  });

  it("keeps subdivision out of geocode candidates so the exact address stays primary", () => {
    expect(
      buildGoogleMapsAddressCandidates("101 Main St", {
        subdivision: "Hidden Lakes",
      }),
    ).toEqual(["101 Main St"]);
  });

  it("uses subdivision-derived city and state to constrain exact address candidates", () => {
    expect(
      buildGoogleMapsAddressCandidates("101 Main St", {
        subdivision: "Hidden Lakes",
        locality: "Katy",
        administrativeArea: "TX",
      }),
    ).toEqual([
      "101 Main St, Katy, TX",
      "101 Main St",
    ]);
  });

  it("ignores empty subdivision context when building address candidates", () => {
    expect(
      buildGoogleMapsAddressCandidates("101 Main St", {
        subdivision: "  ",
      }),
    ).toEqual(["101 Main St"]);
  });

  it("treats only successful geocoding responses with results as found", () => {
    expect(
      isGoogleMapsAddressFound({ status: "OK", results: [{ place_id: "place-1" }] }),
    ).toBe(true);
    expect(isGoogleMapsAddressFound({ status: "ZERO_RESULTS", results: [] })).toBe(false);
    expect(isGoogleMapsAddressFound({ status: "OK", results: [] })).toBe(false);
  });

  it("extracts city and state context from a subdivision geocode result", () => {
    expect(
      extractGoogleMapsLocationContext({
        status: "OK",
        results: [
          {
            formatted_address: "Hidden Lakes, Katy, TX 77494, USA",
            address_components: [
              { long_name: "Hidden Lakes", short_name: "Hidden Lakes", types: ["neighborhood"] },
              { long_name: "Katy", short_name: "Katy", types: ["locality", "political"] },
              { long_name: "Texas", short_name: "TX", types: ["administrative_area_level_1", "political"] },
              { long_name: "United States", short_name: "US", types: ["country", "political"] },
            ],
          },
        ],
      }),
    ).toEqual({
      locality: "Katy",
      administrativeArea: "TX",
      country: "US",
    });
  });

  it("uses subdivision context to choose the best exact-address geocode result", () => {
    const result = selectBestGoogleMapsResult(
      {
        status: "OK",
        results: [
          {
            place_id: "wrong-state",
            formatted_address: "101 Main St, Springfield, IL",
            address_components: [
              { long_name: "Downtown", short_name: "Downtown", types: ["neighborhood"] },
            ],
          },
          {
            place_id: "right-subdivision",
            formatted_address: "101 Main St, Hidden Lakes, TX",
            address_components: [
              { long_name: "Hidden Lakes", short_name: "Hidden Lakes", types: ["neighborhood"] },
            ],
          },
        ],
      },
      { subdivision: "Hidden Lakes" },
    );

    expect(result?.place_id).toBe("right-subdivision");
  });

  it("selects a street-level geocode result instead of a city-only result", () => {
    const result = selectBestGoogleMapsAddressResult({
      status: "OK",
      results: [
        {
          place_id: "city-only",
          formatted_address: "Katy, TX, USA",
          types: ["locality", "political"],
          address_components: [
            { long_name: "Katy", short_name: "Katy", types: ["locality", "political"] },
            { long_name: "Texas", short_name: "TX", types: ["administrative_area_level_1", "political"] },
          ],
        },
        {
          place_id: "street-address",
          formatted_address: "101 Main St, Katy, TX 77494, USA",
          types: ["street_address"],
          address_components: [
            { long_name: "101", short_name: "101", types: ["street_number"] },
            { long_name: "Main Street", short_name: "Main St", types: ["route"] },
            { long_name: "Katy", short_name: "Katy", types: ["locality", "political"] },
          ],
        },
      ],
    });

    expect(result?.place_id).toBe("street-address");
  });

  it("rejects geocode responses that only resolve to a city", () => {
    const result = selectBestGoogleMapsAddressResult({
      status: "OK",
      results: [
        {
          place_id: "city-only",
          formatted_address: "Katy, TX, USA",
          types: ["locality", "political"],
          address_components: [
            { long_name: "Katy", short_name: "Katy", types: ["locality", "political"] },
            { long_name: "Texas", short_name: "TX", types: ["administrative_area_level_1", "political"] },
          ],
        },
      ],
    });

    expect(result).toBeNull();
  });

  it("matches the requested house number and street name before accepting an address result", () => {
    const result = selectBestGoogleMapsAddressResult(
      {
        status: "OK",
        results: [
          {
            place_id: "wrong-street",
            formatted_address: "2065 Solstice Way, Katy, TX 77493, USA",
            types: ["street_address"],
            address_components: [
              { long_name: "2065", short_name: "2065", types: ["street_number"] },
              { long_name: "Solstice Way", short_name: "Solstice Way", types: ["route"] },
            ],
          },
          {
            place_id: "solstice-landing",
            formatted_address: "2065 Solstice Landing Dr, Katy, TX 77493, USA",
            types: ["street_address"],
            address_components: [
              { long_name: "2065", short_name: "2065", types: ["street_number"] },
              { long_name: "Solstice Landing Drive", short_name: "Solstice Lndg Dr", types: ["route"] },
            ],
          },
        ],
      },
      { address: "2065 Solstice Lndg Dr" },
    );

    expect(result?.place_id).toBe("solstice-landing");
  });

  it("rejects street-level results that do not match the requested address", () => {
    const result = selectBestGoogleMapsAddressResult(
      {
        status: "OK",
        results: [
          {
            place_id: "wrong-address",
            formatted_address: "2065 Solstice Way, Katy, TX 77493, USA",
            types: ["street_address"],
            address_components: [
              { long_name: "2065", short_name: "2065", types: ["street_number"] },
              { long_name: "Solstice Way", short_name: "Solstice Way", types: ["route"] },
            ],
          },
        ],
      },
      { address: "2065 Solstice Lndg Dr" },
    );

    expect(result).toBeNull();
  });

  it("falls back to the first exact-address result when subdivision is not in Google's results", () => {
    const result = selectBestGoogleMapsResult(
      {
        status: "OK",
        results: [
          {
            place_id: "first-result",
            formatted_address: "101 Main St, Springfield, IL",
          },
          {
            place_id: "second-result",
            formatted_address: "101 Main St, Austin, TX",
          },
        ],
      },
      { subdivision: "Hidden Lakes" },
    );

    expect(result?.place_id).toBe("first-result");
  });
});
