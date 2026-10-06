import { Palette } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ThemeSwitcher } from "@/components/theme-switcher";
// Custom accent colors are paused. Restore this picker when they return.
// import { ThemeSwitcherWithColors } from "../theme-switcher-withcolors ";

export function SettingsAppearanceCard() {
  return (
    <Card className="min-w-0 gap-4 p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Palette className="size-4 text-muted-foreground" />
        Appearance
      </div>

      <p className="text-sm text-muted-foreground">
        Choose light, dark, or automatic appearance.
      </p>

      <div>
        <ThemeSwitcher hideLabel={false} />
        {/* <ThemeSwitcherWithColors /> */}
      </div>
    </Card>
  );
}
