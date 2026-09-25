import { describe, expect, it } from "vitest";
import {
  getProjectStreetGroupLabel,
  renameProjectStreetAddress,
} from "@/components/projects/project-location";

describe("street group addresses", () => {
  it("derives the shared street label without the house number", () => {
    expect(getProjectStreetGroupLabel("1234 Main Street")).toBe("Main Street");
  });

  it("renames only the street while preserving the house number", () => {
    expect(renameProjectStreetAddress("1234 Main Street", "oak avenue")).toBe(
      "1234 Oak Avenue",
    );
  });

  it("preserves legacy city and state suffixes", () => {
    expect(
      renameProjectStreetAddress(
        "1234 Main Street, Dallas, TX 75001",
        "Oak Avenue",
      ),
    ).toBe("1234 Oak Avenue, Dallas, TX 75001");
  });

  it("returns null when an address has no leading numeric house number", () => {
    expect(renameProjectStreetAddress("Main Street", "Oak Avenue")).toBeNull();
  });

  it("returns null when the replacement street is empty", () => {
    expect(renameProjectStreetAddress("1234 Main Street", "   ")).toBeNull();
  });
});
