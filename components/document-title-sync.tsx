"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function getPageTitle(pathname: string): string | null {
  if (pathname === "/dashboard") return "Dashboard";
  if (pathname.startsWith("/projects")) return "Projects";
  if (pathname.startsWith("/map")) return "Map";
  if (pathname.startsWith("/calendar")) return "Calendar";
  if (pathname.startsWith("/invoices")) return "Invoices";
  if (pathname.startsWith("/settings")) return "Settings";
  if (pathname.startsWith("/accounting")) return "Accounting";
  if (pathname.startsWith("/payroll")) return "Payroll";
  if (pathname.startsWith("/employees-crews")) return "Employees & Crews";
  if (pathname.startsWith("/search")) return "Search";
  if (pathname.startsWith("/login")) return "Sign In";
  if (pathname.startsWith("/signup")) return "Create Account";
  if (pathname.startsWith("/verify")) return "Verify Email";
  return null;
}

export function DocumentTitleSync() {
  const pathname = usePathname();

  useEffect(() => {
    const pageTitle = getPageTitle(pathname);

    // Public marketing pages rely on route metadata for SEO, so only patch
    // titles for authenticated and account surfaces here.
    if (!pageTitle) return;

    document.title = `${pageTitle} | JobSyte`;
  }, [pathname]);

  return null;
}
