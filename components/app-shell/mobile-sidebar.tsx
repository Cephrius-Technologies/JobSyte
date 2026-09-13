"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "./sidebar-nav";
import { CompanySwitcher } from "./company-switcher";
import { VersionChangelogDialog } from "./version-changelog-dialog";
import { cn } from "@/lib/utils";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [openedRouteKey, setOpenedRouteKey] = useState(routeKey);

  const isOpen = open && openedRouteKey === routeKey;

  return (
    <Sheet
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpenedRouteKey(routeKey);
        }
        setOpen(nextOpen);
      }}
    >
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Open navigation menu"
          className={cn(
            "h-9 w-9 shrink-0 cursor-pointer border-border hover:bg-muted md:hidden",
          )}
        >
          <Menu className="size-4" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="flex max-w-[320px] flex-col gap-0 overflow-hidden rounded-2xl border border-sidebar-border bg-sidebar p-0 shadow-xl data-[side=left]:inset-y-3 data-[side=left]:left-3 data-[side=left]:h-[calc(100dvh-1.5rem)] data-[side=left]:w-[82vw] data-[side=left]:sm:max-w-[320px]"
      >
        <SheetHeader className="p-4 pr-14">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Jump to any section of JobSyte.
          </SheetDescription>
          <CompanySwitcher />
        </SheetHeader>

        <Separator />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <SidebarNav />
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs text-muted-foreground">
          <VersionChangelogDialog />
          <a
            href="https://cephrius.com"
            className="underline hover:text-primary"
          >
            Cephrius Technologies
          </a>
          <span>© JobSyte</span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
