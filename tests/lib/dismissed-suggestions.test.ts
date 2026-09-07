// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
  addDismissedId,
  getDismissedIds,
  removeDismissedId,
} from "@/lib/dismissed-suggestions";

describe("dismissed suggestions storage", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("stores dismissed values per company and field without duplicates", () => {
    addDismissedId("company-1", "job-title", "framer");
    addDismissedId("company-1", "job-title", "framer");
    addDismissedId("company-1", "job-price", "1000");
    addDismissedId("company-2", "job-title", "electrician");

    expect([...getDismissedIds("company-1", "job-title")]).toEqual(["framer"]);
    expect([...getDismissedIds("company-1", "job-price")]).toEqual(["1000"]);
    expect([...getDismissedIds("company-2", "job-title")]).toEqual([
      "electrician",
    ]);
  });

  it("handles missing company ids, invalid payloads, and removals safely", () => {
    window.localStorage.setItem(
      "jobsyte:dismissed-suggestions:company-1:job-title",
      JSON.stringify(["trim", 42, null]),
    );

    expect([...getDismissedIds("company-1", "job-title")]).toEqual(["trim"]);
    expect([...getDismissedIds(null, "job-title")]).toEqual([]);

    removeDismissedId("company-1", "job-title", "trim");
    expect([...getDismissedIds("company-1", "job-title")]).toEqual([]);
  });
});
