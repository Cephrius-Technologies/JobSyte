import { DesktopSidebar } from "./desktop-sidebar";

export function Sidebar() {
  return (
    <div
          data-app-shell-sidebar
          className="hidden md:block md:h-dvh md:shrink-0 md:p-2"
        >
      <DesktopSidebar />
    </div>
  );
}
