import { DesktopSidebar } from "./desktop-sidebar";

export function Sidebar() {
  return (
    <div
          data-app-shell-sidebar
          className="hidden md:sticky md:top-0 md:block md:h-dvh md:shrink-0 md:self-start md:p-2"
        >
      <DesktopSidebar />
    </div>
  );
}
