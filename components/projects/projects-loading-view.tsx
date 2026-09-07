"use client";

import type { ReactNode } from "react";
import { useBrowserStoredState } from "@/hooks/use-browser-storage";
import { parseProjectsView, PROJECTS_VIEW_STORAGE_KEY, type ProjectsView } from "./projects-view";

export function ProjectsLoadingView({ children, grouped }: { children: ReactNode; grouped: ReactNode }) {
  const [view] = useBrowserStoredState<ProjectsView>({
    key: PROJECTS_VIEW_STORAGE_KEY,
    defaultValue: "list",
    parse: parseProjectsView,
    serialize: (value) => value,
  });

  return view === "grouped" ? grouped : children;
}
