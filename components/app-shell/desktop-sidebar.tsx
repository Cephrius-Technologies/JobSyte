"use client";

import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { SidebarNav } from "./sidebar-nav";
import { cn } from "@/lib/utils";
import { useSidebarState } from "./sidebar-state";
import { VersionChangelogDialog } from "./version-changelog-dialog";
import { CompanySwitcher } from "./company-switcher";
import { useCompany } from "@/lib/company-context";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

function companyInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function DesktopSidebar() {
  const { collapsed } = useSidebarState();
  const { activeCompany } = useCompany();
  const initials = companyInitials(activeCompany?.name ?? "");

  return (
    <aside
      className={cn(
        "hidden overflow-y-auto border-r border-border bg-sidebar md:sticky md:top-0 md:flex md:h-dvh md:shrink-0 md:flex-col md:self-start transition-[width] duration-200 motion-reduce:transition-none",
        collapsed ? "md:w-[72px]" : "md:w-60",
      )}
    >
      {!collapsed && <div className="px-5 pt-5 text-sm font-semibold tracking-tight">JobSyte</div>}
      <div
        className={cn(
          "flex items-center p-3",
          collapsed ? "justify-center" : "justify-between",
        )}
      >
        <div className={cn("min-w-0 flex-1 p-2", collapsed && "text-center")}>
          {collapsed ? (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="flex items-center justify-center rounded-lg transition-transform hover:scale-105 active:scale-95 cursor-pointer"
                  aria-label={`Switch company — ${activeCompany?.name}`}
                >
                  {activeCompany?.logo_url ? (
                    <Image
                      src={activeCompany.logo_url}
                      alt={activeCompany.name}
                      width={36}
                      height={36}
                      className="size-9 rounded-lg object-contain"
                    />
                  ) : (
                    <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold">
                      {initials || "JS"}
                    </div>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={12}
                className="w-72 p-0"
              >
                <CompanySwitcher />
              </PopoverContent>
            </Popover>
          ) : (
            <CompanySwitcher />
          )}
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
