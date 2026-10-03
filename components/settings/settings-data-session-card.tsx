import Link from "next/link";
import { Download, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type SettingsDataSessionCardProps = {
  signingOutAll: boolean;
  onSignOutEverywhere: () => void;
};

export function SettingsDataSessionCard({
  signingOutAll,
  onSignOutEverywhere,
}: SettingsDataSessionCardProps) {
  return (
    <Card className="min-w-0 gap-4 border-destructive/40 p-5">
      <div className="text-lg font-semibold text-destructive">
        Data & Session
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="outline">
          <Link href="/api/settings/export">
            <Download className="size-4" />
            Export My Data (JSON)
          </Link>
        </Button>

        <Button
          type="button"
          variant="destructive"
          onClick={onSignOutEverywhere}
          disabled={signingOutAll}
        >
          <LogOut className="size-4" />
          {signingOutAll ? "Signing Out..." : "Sign Out All Sessions"}
        </Button>
      </div>
    </Card>
  );
}
