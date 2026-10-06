"use client";

import { History } from "lucide-react";
import { Card } from "@/components/ui/card";
import { VersionChangelogDialog } from "@/components/app-shell/version-changelog-dialog";
import { LATEST_RELEASE } from "@/lib/release-notes";

export function SettingsReleaseNotesCard() {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-base font-semibold text-foreground">
            <History className="size-4" />
            Release Notes
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            See what&apos;s new in JobSyte. Currently on{" "}
            <span className="font-medium text-foreground">
              {LATEST_RELEASE.version}
            </span>{" "}
            · {LATEST_RELEASE.releasedOn}
          </p>
        </div>
        <VersionChangelogDialog />
      </div>
    </Card>
  );
}
