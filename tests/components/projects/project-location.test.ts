import { describe, expect, it } from "vitest";
import {
  getProjectDirectionsUrl,
  getProjectLocationSubtitle,
  getProjectMapAddress,
  getProjectStreetTitle,
} from "@/components/projects/project-location";

describe("project location helpers", () => {
  it("keeps city and state from comma-formatted project addresses", () => {
    const project = {
      project_address: "2065 Solstice Lndg Dr, Katy, TX 77493",
      project_city: null,
      project_state: null,
    };

    expect(getProjectStreetTitle(project)).toBe("2065 Solstice Lndg Dr");
    expect(getProjectLocationSubtitle(project)).toBe("Katy, TX");
    expect(getProjectMapAddress(project)).toBe("2065 Solstice Lndg Dr, Katy, TX");
  });

  it("prefers structured project city and state when present", () => {
    expect(
      getProjectMapAddress({
        project_address: "2065 Solstice Lndg Dr, Old City, ZZ 00000",
        project_city: "Katy",
        project_state: "TX",
      }),
    ).toBe("2065 Solstice Lndg Dr, Katy, TX");
  });

  it("opens directions to the current project address", () => {
    const url = getProjectDirectionsUrl({
      project_address: "2065 Solstice Lndg Dr, Old City, ZZ 00000",
      project_city: "Katy",
      project_state: "TX",
    });

    expect(url).not.toBeNull();
    expect(new URL(url!).searchParams.get("destination")).toBe(
      "2065 Solstice Lndg Dr, Katy, TX",
    );
  });

  it("does not create a directions link without an address", () => {
    expect(getProjectDirectionsUrl({ project_address: "" })).toBeNull();
  });
});
