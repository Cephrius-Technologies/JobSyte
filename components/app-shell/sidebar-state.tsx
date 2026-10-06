"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useBrowserStoredState } from "@/hooks/use-browser-storage";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "app-shell:sidebar-collapsed";

type SidebarState = {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  toggleCollapsed: () => void;
};

const SidebarStateContext = createContext<SidebarState | null>(null);

export function SidebarStateProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useBrowserStoredState({
    key: SIDEBAR_COLLAPSED_STORAGE_KEY,
    defaultValue: false,
    parse: (raw) => raw === "1",
    serialize: (value) => (value ? "1" : "0"),
  });

  const toggleCollapsed = useCallback(
    () => setCollapsed((current) => !current),
    [setCollapsed],
  );

  const value = useMemo(
    () => ({
      collapsed,
      setCollapsed,
      toggleCollapsed,
    }),
    [collapsed, setCollapsed, toggleCollapsed],
  );

  return (
    <SidebarStateContext.Provider value={value}>
      {children}
    </SidebarStateContext.Provider>
  );
}

export function useSidebarState() {
  const context = useContext(SidebarStateContext);
  if (!context) {
    throw new Error("useSidebarState must be used within a SidebarStateProvider");
  }
  return context;
}
