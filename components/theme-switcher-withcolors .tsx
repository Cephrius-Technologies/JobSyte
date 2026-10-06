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
import { cn } from "@/lib/utils";

type ThemeMode = "light" | "dark" | "system";

const PRIMARY_COLOR_STORAGE_KEY = "theme:primary-color";



const PRIMARY_COLORS = [
  { id: "yellow", label: "Yellow", primary: "#eab308", foreground: "#000000" },
  { id: "blue", label: "Blue", primary: "#2563eb", foreground: "#ffffff" },
  { id: "teal", label: "Teal", primary: "#0f766e", foreground: "#ffffff" },
  { id: "amber", label: "Amber", primary: "#d97706", foreground: "#ffffff" },
  { id: "rose", label: "Rose", primary: "#e11d48", foreground: "#ffffff" },
  { id: "violet", label: "Violet", primary: "#7c3aed", foreground: "#ffffff" },
  { id: "white", label: "White", primary: "#000000", foreground: "#000000" },
] as const;

type PrimaryColorKey = (typeof PRIMARY_COLORS)[number]["id"];

const DEFAULT_PRIMARY_COLOR: PrimaryColorKey = "yellow";

function isPrimaryColorKey(value: string | null): value is PrimaryColorKey {
  return PRIMARY_COLORS.some((color) => color.id === value);
}

function getStoredPrimaryColor(): PrimaryColorKey {
  if (typeof window === "undefined") return DEFAULT_PRIMARY_COLOR;

  const saved = window.localStorage.getItem(PRIMARY_COLOR_STORAGE_KEY);
  return isPrimaryColorKey(saved) ? saved : DEFAULT_PRIMARY_COLOR;
}

// The "white" primary color (#ffffff) doesn't adapt to the current theme —
// on light mode it's invisible against the light background.
// Fix: Make it theme-aware so it renders as black in light mode and
// white in dark mode. applyPrimaryColor accepts resolvedTheme to handle this.
function applyPrimaryColor(key: PrimaryColorKey, resolvedTheme?: string) {
  const color = PRIMARY_COLORS.find((c) => c.id === key) ?? PRIMARY_COLORS[0];
  const root = document.documentElement;

  // For the "white" color, swap to black in light mode so it's visible
  // against the light background. In dark mode, keep it white.
  const isLight = resolvedTheme === "light";
  const primary = color.id === "white" && isLight ? "#000000" : color.primary;
  // Foreground must contrast with primary — white text on black bg (light),
  // black text on white bg (dark), matching the original entry's foreground.
  const foreground = color.id === "white" && isLight ? "#ffffff" : color.foreground;


  root.style.setProperty("--primary", primary);
  root.style.setProperty("--primary-foreground", foreground);
  root.style.setProperty("--sidebar-primary", primary);
  root.style.setProperty("--sidebar-primary-foreground", foreground);
}

export function ThemeSwitcherWithColors({
  hideLabel = false,
}: {
  hideLabel?: boolean;
} = {}) {
  // Pull resolvedTheme so we always know whether we're in light or dark mode
  // (even when the user has selected "system").
  const { theme = "system", resolvedTheme, setTheme } = useTheme();

  const selectedTheme: ThemeMode =
    theme === "light" || theme === "dark" || theme === "system"
      ? theme
      : "light";

  const [primaryColor, setPrimaryColor] = useState<PrimaryColorKey>(
    DEFAULT_PRIMARY_COLOR,
  );
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

  useEffect(() => {
    const storedPrimaryColor = getStoredPrimaryColor();
    if (storedPrimaryColor === DEFAULT_PRIMARY_COLOR) return;

    // Load localStorage after hydration so a saved accent color cannot create
    // a server/client mismatch in the theme dropdown or trigger swatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrimaryColor(storedPrimaryColor);
  }, []);

  // Apply the accent once per actual color/theme value. Keeping this separate
  // from storage reads avoids duplicate CSS variable writes during theme flips.
  useEffect(() => {
    applyPrimaryColor(primaryColor, resolvedTheme);
  }, [resolvedTheme, primaryColor]);

  function setThemeSmooth(next: ThemeMode) {
    beginThemeTransition();
    // Let the transition class land before next-themes flips .dark on <html>.
    // This avoids the old 100ms pause while still giving the browser a stable
    // before/after style pair to interpolate.
    window.requestAnimationFrame(() => setTheme(next));
  }

  function setPrimaryColorSmooth(next: PrimaryColorKey) {
    beginThemeTransition();
    setPrimaryColor(next);
    applyPrimaryColor(next, resolvedTheme);
    window.localStorage.setItem(PRIMARY_COLOR_STORAGE_KEY, next);
  }

  // Until mounted, mirror the SSR output: `theme` defaults to "system", which
  // renders MonitorIcon. Only after hydration do we switch to the real theme.
  const ActiveIcon = useMemo(() => {
    if (!mounted) return MonitorIcon;
    if (selectedTheme === "light") return SunIcon;
    if (selectedTheme === "dark") return MoonIcon;
    return MonitorIcon;
  }, [mounted, selectedTheme]);

  // `resolvedTheme` is undefined on the server, so light-mode swatch overrides
  // must stay off until mounted to keep the first client render in sync.
  const isLightMode = mounted && resolvedTheme === "light";

  const activePrimary = useMemo(
    () =>
      PRIMARY_COLORS.find((c) => c.id === primaryColor) ?? PRIMARY_COLORS[0],
    [primaryColor],
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label="Theme"
          className="cursor-pointer border-primary/30 hover:bg-primary/10"
        >
          <ActiveIcon className="size-4" />
          <span className={cn(hideLabel ? "hidden" : "hidden sm:inline")}>
            Theme
          </span>
          <span
            className="size-3 rounded-full border"
            style={{
              // Reflect the adapted color in the trigger swatch —
              // black for "white" in light mode, otherwise the original.
              backgroundColor:
                activePrimary.id === "white" && isLightMode
                  ? "#000000"
                  : activePrimary.primary,
            }}
            aria-hidden="true"
          />
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

        <DropdownMenuSeparator />
        <DropdownMenuLabel>Primary Color</DropdownMenuLabel>

        <DropdownMenuRadioGroup
          value={primaryColor}
          onValueChange={(value) => {
            if (PRIMARY_COLORS.some((c) => c.id === value)) {
              setPrimaryColorSmooth(value as PrimaryColorKey);
            }
          }}
        >
          {PRIMARY_COLORS.map((color) => (
            <DropdownMenuRadioItem key={color.id} value={color.id}>
              <span
                className="size-3 rounded-full border"
                style={{
                  // Show black swatch for "white" color in light mode
                  // so the preview matches the actual applied color.
                  backgroundColor:
                    color.id === "white" && isLightMode
                      ? "#000000"
                      : color.primary,
                }}
                aria-hidden="true"
              />
              {/* Swap black/white swatch for "white" color in light mode */}
              {color.id === "white" && isLightMode ? "Black" : color.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
