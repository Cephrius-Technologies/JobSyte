import { Palette } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThemeSwitcherWithColors } from "../theme-switcher-withcolors ";

export function SettingsAppearanceCard() {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Palette className="size-4 text-muted-foreground" />
        Appearance
      </div>

      <p className="text-sm text-muted-foreground">
        Pick the app theme and accent color used across dashboard pages.
      </p>

      <div>
        <ThemeSwitcherWithColors />
      </div>
    </Card>
  );
}
