import { LATEST_RELEASE, RELEASE_NOTES } from "@/lib/release-notes";
import { describe, expect, it } from "vitest";

describe("release notes metadata", () => {
  it("keeps the latest release pointed at the first changelog entry", () => {
    expect(RELEASE_NOTES.length).toBeGreaterThan(0);
    expect(LATEST_RELEASE).toBe(RELEASE_NOTES[0]);
  });

  it("requires each release entry to have user-facing content", () => {
    for (const note of RELEASE_NOTES) {
      expect(note.version).toMatch(/^v\d+\.\d+\.\d+/);
      expect(note.releasedOn).not.toHaveLength(0);
      expect(note.changes.length + note.bugFixes.length).toBeGreaterThan(0);
    }
  });
});
