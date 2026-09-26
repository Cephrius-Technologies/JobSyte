import { describe, expect, it } from "vitest";
import { formatJobDisplayId } from "@/lib/jobs/job-id";

describe("formatJobDisplayId", () => {
  it("converts the final eight hexadecimal database ID characters to numeric digits", () => {
    expect(formatJobDisplayId("123e4567-e89b-12d3-a456-426600047a6c")).toBe("JS293484");
    expect(formatJobDisplayId("123e4567-e89b-12d3-a456-4266abcdef12")).toMatch(/^JS\d+$/);
  });

  it("does not replace the database ID with the display ID", () => {
    const id = "123e4567-e89b-12d3-a456-426614174000";
    formatJobDisplayId(id);
    expect(id).toBe("123e4567-e89b-12d3-a456-426614174000");
  });
});
