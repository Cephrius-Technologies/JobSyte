// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BreadcrumbProvider, useBreadcrumbs } from "@/components/app-shell/breadcrumb-context";
import { BreadcrumbSetter } from "@/components/app-shell/breadcrumb-setter";

const route = vi.hoisted(() => ({ pathname: "/projects/one" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));

function Header() {
  const { crumbs, rightSlot } = useBreadcrumbs();
  return <><nav>{crumbs.map((crumb) => crumb.label).join(" / ")}</nav>{rightSlot}</>;
}

describe("route-scoped breadcrumbs", () => {
  beforeEach(() => { route.pathname = "/projects/one"; });

  it("does not show the previous page's labels or actions while the next page loads", () => {
    const view = render(<BreadcrumbProvider><Header /><BreadcrumbSetter crumbs={[{ label: "Oak Meadow" }]} rightSlot={<button>Edit project</button>} /></BreadcrumbProvider>);
    expect(screen.getByRole("navigation")).toHaveTextContent("Oak Meadow");
    route.pathname = "/invoices";
    view.rerender(<BreadcrumbProvider><Header /></BreadcrumbProvider>);
    expect(screen.getByRole("navigation")).not.toHaveTextContent("Oak Meadow");
    expect(screen.queryByRole("button", { name: "Edit project" })).not.toBeInTheDocument();
    view.rerender(<BreadcrumbProvider><Header /><BreadcrumbSetter crumbs={[{ label: "Invoices" }]} /></BreadcrumbProvider>);
    expect(screen.getByRole("navigation")).toHaveTextContent("Invoices");
  });
});
