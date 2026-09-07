"use client"

import React, { useCallback, useContext, useMemo } from "react";
import { usePathname } from "next/navigation";

export type Crumb = {label: string, href?: string};

type BreadcrumbState = {
    crumbs: Crumb[];
    setCrumbs: (crumbs: Crumb[]) => void;
    rightSlot: React.ReactNode | null;
    setRightSlot: (node: React.ReactNode | null) => void;
};

const BreadcrumbContext = React.createContext<BreadcrumbState | null>(null);

export function BreadcrumbProvider({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [pageCrumbs, setPageCrumbs] = React.useState<{ pathname: string; crumbs: Crumb[] } | null>(null);
    const [pageActions, setPageActions] = React.useState<{ pathname: string; node: React.ReactNode } | null>(null);
    const setCrumbs = useCallback((crumbs: Crumb[]) => setPageCrumbs({ pathname, crumbs }), [pathname]);
    const setRightSlot = useCallback((node: React.ReactNode | null) => setPageActions({ pathname, node }), [pathname]);

    const value = useMemo(
        () => ({
            crumbs: pageCrumbs?.pathname === pathname ? pageCrumbs.crumbs : [],
            setCrumbs,
            rightSlot: pageActions?.pathname === pathname ? pageActions.node : null,
            setRightSlot,
        }),
        [pageCrumbs, pageActions, pathname, setCrumbs, setRightSlot]
    );

    return (
        <BreadcrumbContext.Provider value={value}>
            {children}
        </BreadcrumbContext.Provider>
    );

}

export function useBreadcrumbs() {
    const ctx = useContext(BreadcrumbContext);
    if (!ctx) throw new Error("useBreadcrumbs must be used within a BreadcrumbProvider");
    return ctx;
}
