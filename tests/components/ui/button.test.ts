import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";

describe("buttonVariants", () => {
  it("keeps the login button orange with readable text", () => {
    const classes = buttonVariants({ variant: "login" as never });

    expect(classes).toContain("bg-[#ff6f00]");
    expect(classes).toContain("text-white");
    expect(classes).toContain("hover:bg-[#e66300]");
  });
});
