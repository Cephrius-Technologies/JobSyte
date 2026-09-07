"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ThemeMode = "light" | "dark" | "system";

export function ThemeSwitcher({
  hideLabel = true,
}: {
  hideLabel?: boolean;
} = {}) {
  // Pull resolvedTheme so we always know whether we're in light or dark mode
  // (even when the user has selected "system").
  const { theme = "system", setTheme } = useTheme();

  const selectedTheme: ThemeMode =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "light";

  // next-themes only knows the real theme on the client, so the server render
  // and the first client render must be identical. `mounted` stays false until
  // after hydration; theme-dependent output (the active icon, the swatch color)
  // is computed from a stable default until then to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const transitionCleanupRef = useRef<number | null>(null);

  const THEME_TRANSITION_MS = 180;

  function beginThemeTransition() {
    const root = document.documentElement;

    if (transitionCleanupRef.current !== null) {
      window.clearTimeout(transitionCleanupRef.current);
      transitionCleanupRef.current = null;
    }

    root.classList.add("theme-transitioning");
    transitionCleanupRef.current = window.setTimeout(() => {
      root.classList.remove("theme-transitioning");
      transitionCleanupRef.current = null;
    }, THEME_TRANSITION_MS + 80);
  }

  // Flip to the real (client-known) theme only after hydration completes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    return () => {
      if (transitionCleanupRef.current !== null) {
        window.clearTimeout(transitionCleanupRef.current);
      }
      document.documentElement.classList.remove("theme-transitioning");
    };
  }, []);

  function setThemeSmooth(next: ThemeMode) {
    beginThemeTransition();
    // Let the transition class land before next-themes flips .dark on <html>.
    // This avoids the old 100ms pause while still giving the browser a stable
    // before/after style pair to interpolate.
    window.requestAnimationFrame(() => setTheme(next));
  }


  // Until mounted, mirror the SSR output: `theme` defaults to "system", which
  // renders MonitorIcon. Only after hydration do we switch to the real theme.
  const ActiveIcon = useMemo(() => {
    if (!mounted) return MonitorIcon;
    if (selectedTheme === "light") return SunIcon;
    if (selectedTheme === "dark") return MoonIcon;
    return MonitorIcon;
  }, [mounted, selectedTheme]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Theme"
          className="cursor-pointer border-border hover:bg-muted"
        >
          <ActiveIcon className="size-4" />
          {!hideLabel && <span>Appearance</span>}

        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuRadioGroup
          value={selectedTheme}
          onValueChange={(value) => setThemeSmooth(value as ThemeMode)}
        >
          <DropdownMenuRadioItem value="light">
            <SunIcon className="size-4" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <MoonIcon className="size-4" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <MonitorIcon className="size-4" />
            Auto
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
