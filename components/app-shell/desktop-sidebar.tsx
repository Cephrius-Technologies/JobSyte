"use client";

import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./sidebar-nav";
import { cn } from "@/lib/utils";
import { useSidebarState } from "./sidebar-state";
import { VersionChangelogDialog } from "./version-changelog-dialog";
import { CompanySwitcher } from "./company-switcher";
import { SidebarBrand } from "./sidebar-brand";

export function DesktopSidebar() {
  const { collapsed } = useSidebarState();

  return (
    <aside
      className={cn(
        "hidden overflow-y-auto overscroll-y-contain rounded-2xl border border-sidebar-border bg-sidebar shadow-md md:flex md:h-full md:flex-col transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "md:w-[72px]" : "md:w-60",
      )}
    >
      <div className={cn("px-3 pb-3 pt-4", collapsed && "px-2 pb-2 pt-3")}>
        <div className={cn("flex justify-start px-2", collapsed && "justify-center px-0")}>
          <SidebarBrand compact={collapsed} />
        </div>
        {!collapsed && (
          <p className="mb-1.5 mt-3 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Current company
          </p>
        )}
        <div className={cn(collapsed && "mt-3 flex justify-center")}>
          <CompanySwitcher compact={collapsed} />
        </div>
      </div>

      <Separator />

      <SidebarNav collapsed={collapsed} />

      <div
        className={cn(
          "mt-auto space-y-2 border-t border-border p-4 text-xs text-muted-foreground flex-col",
          collapsed && "text-center",
        )}
      >
        <VersionChangelogDialog collapsed={collapsed} />
        {!collapsed && (
          <>
            {" "}
            <a
              href="https://cephrius.com"
              className="underline hover:text-primary"
            >
              Cephrius Technologies
            </a>
            <a>© JobSyte</a>
          </>
        )}
      </div>
    </aside>
  );
}
