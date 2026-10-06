// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { GET } from "@/app/api/maps/geocode/route";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

describe("GET /api/maps/geocode", () => {
  beforeEach(() => {
    vi.stubEnv("GOOGLE_MAPS_API_KEY", "google-api-key");
    vi.mocked(createClient).mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
          error: null,
        }),
      },
    } as never);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "OK",
          results: [
            {
              place_id: "google-place-1",
              formatted_address: "2065 Solstice Landing Drive, Katy, TX",
              types: ["street_address"],
              geometry: { location: { lat: 29.7854, lng: -95.8245 } },
              address_components: [
                {
                  long_name: "2065",
                  short_name: "2065",
                  types: ["street_number"],
                },
                {
                  long_name: "Solstice Landing Drive",
                  short_name: "Solstice Lndg Dr",
                  types: ["route"],
                },
              ],
            },
          ],
        }),
      }),
    );
  });

  it("returns Google coordinates in the Mapbox handoff contract", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/maps/geocode?address=2065%20Solstice%20Lndg%20Dr%2C%20Katy%2C%20TX",
      ),
    );

    expect(await response.json()).toMatchObject({
      found: true,
      provider: "google-maps",
      coordinates: { lat: 29.7854, lng: -95.8245 },
    });
  });
});
