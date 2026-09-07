import { describe, expect, it } from "vitest";
import {
  buildMapboxStaticImageUrl,
  getMapboxAccessToken,
  getPublicMapboxAccessToken,
} from "@/lib/maps/mapbox";

describe("mapbox helpers", () => {
  it("returns the public Mapbox token before the server fallback", () => {
    expect(
      getMapboxAccessToken({
        NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: " public-mapbox-token ",
        MAPBOX_ACCESS_TOKEN: " server-mapbox-token ",
      }),
    ).toBe("public-mapbox-token");
  });

  it("does not expose the server-only Mapbox token as a public token", () => {
    expect(
      getPublicMapboxAccessToken({
        MAPBOX_ACCESS_TOKEN: " server-mapbox-token ",
      }),
    ).toBe("");
  });

  it("builds a Mapbox static map URL with a marker", () => {
    const url = buildMapboxStaticImageUrl({
      accessToken: "mapbox-token",
      markers: [{ lat: 29.7854, lng: -95.8245, label: "1" }],
      width: 640,
      height: 480,
    });

    expect(url).toContain(
      "https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/",
    );
    expect(url).toContain("pin-s-1+2563eb(-95.8245,29.7854)");
    expect(url).toContain("-95.8245,29.7854,16,0/640x480@2x");
    expect(url).toContain("access_token=mapbox-token");
  });

  it("returns an empty URL without a token or valid marker", () => {
    expect(
      buildMapboxStaticImageUrl({
        accessToken: "",
        markers: [{ lat: 29.7854, lng: -95.8245 }],
      }),
    ).toBe("");
    expect(
      buildMapboxStaticImageUrl({
        accessToken: "mapbox-token",
        markers: [{ lat: Number.NaN, lng: -95.8245 }],
      }),
    ).toBe("");
  });
});
