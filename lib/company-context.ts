"use client";

// Onboarding: client-side tenant state. The selected company is mirrored into
// the `jobsyte:active-company-id` cookie so server helpers in
// `lib/active-company.ts` can scope Supabase reads and writes.
import {
  createElement,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";

export type Company = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  role: string;
};

type CompanyContextValue = {
  companies: Company[];
  activeCompany: Company | null;
  setActiveCompanyId: (id: string) => void;
};

const CompanyContext = createContext<CompanyContextValue>({
  companies: [],
  activeCompany: null,
  setActiveCompanyId: () => {},
});

const STORAGE_KEY = "jobsyte:active-company-id";
const ACTIVE_COMPANY_EVENT = "jobsyte:active-company-id-change";

function subscribeToActiveCompanyId(onStoreChange: () => void) {
  const timeoutId = window.setTimeout(onStoreChange, 0);

  function handleStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) onStoreChange();
  }

  window.addEventListener("storage", handleStorage);
  window.addEventListener(ACTIVE_COMPANY_EVENT, onStoreChange);

  return () => {
    window.clearTimeout(timeoutId);
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ACTIVE_COMPANY_EVENT, onStoreChange);
  };
}

function notifyActiveCompanyChange() {
  window.dispatchEvent(new Event(ACTIVE_COMPANY_EVENT));
}

export function CompanyProvider({
  companies,
  children,
}: {
  companies: Company[];
  children: React.ReactNode;
}) {
  const fallbackCompanyId = companies[0]?.id ?? "";
  const companyIds = useMemo(
    () => new Set(companies.map((company) => company.id)),
    [companies],
  );
  const activeId = useSyncExternalStore(
    subscribeToActiveCompanyId,
    () => {
      const storedCompanyId = window.localStorage.getItem(STORAGE_KEY) ?? "";
      return companyIds.has(storedCompanyId) ? storedCompanyId : fallbackCompanyId;
    },
    () => fallbackCompanyId,
  );

  const activeCompany =
    companies.find((c) => c.id === activeId) ?? companies[0] ?? null;

  const setActiveCompanyId = useCallback((id: string) => {
    window.localStorage.setItem(STORAGE_KEY, id);
    // Set cookie so server components can read the active company
    document.cookie = `jobsyte:active-company-id=${id};path=/;max-age=31536000;samesite=lax`;
    notifyActiveCompanyChange();
  }, []);

  const value: CompanyContextValue = {
    companies,
    activeCompany,
    setActiveCompanyId,
  };

  return createElement(CompanyContext.Provider, { value }, children);
}

export function useCompany() {
  return useContext(CompanyContext);
}
