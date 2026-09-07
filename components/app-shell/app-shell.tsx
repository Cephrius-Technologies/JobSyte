// Onboarding: this wraps every authenticated product route after
// `app/(jobsyte-app)/(app)/layout.tsx` has loaded company context. Navigation
// details are split across `desktop-sidebar.tsx`, `mobile-sidebar.tsx`, and
// `header.tsx`.
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { BreadcrumbProvider } from "./breadcrumb-context";
import { SidebarStateProvider } from "./sidebar-state";
import { RouteTransition } from "./route-transition";
import { MainView } from "./mainview";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <BreadcrumbProvider>
      <SidebarStateProvider>
        <div className="min-h-screen bg-background">
          <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-card focus:p-3 focus:ring-2 focus:ring-ring">Skip to content</a>
          <div className="flex">
            <Sidebar />
            <div className="min-w-0 flex-1 flex flex-col md:h-dvh">
              <Header />
              <MainView>
                <main id="main-content" data-app-shell-main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 lg:p-8">
                  <RouteTransition>{children}</RouteTransition>
                </main>
              </MainView>
            </div>
          </div>
        </div>
      </SidebarStateProvider>
    </BreadcrumbProvider>
  );
}
