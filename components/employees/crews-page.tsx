"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { HighlightScroller } from "@/components/ui/highlight-scroller";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  FilterDialog,
  FilterDialogSection,
} from "@/components/ui/filter-dialog";
import type { CrewProfile, EmployeeProfile } from "./types";
import { CrewDialog } from "./crew-dialog";
import { FilterChip } from "./filter-chip";

type FilterKey = "all" | "active" | "inactive";

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">
      Inactive
    </Badge>
  );
}

export function CrewsPageClient({
  crews,
  employees,
}: {
  crews: CrewProfile[];
  employees: Pick<EmployeeProfile, "id" | "name" | "is_active">[];
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCrew, setEditingCrew] = useState<CrewProfile | null>(null);

  const filterTabs = useMemo(
    () => [
      { key: "all" as FilterKey, label: "All", count: crews.length },
      { key: "active" as FilterKey, label: "Active", count: crews.filter((c) => c.is_active).length },
      { key: "inactive" as FilterKey, label: "Inactive", count: crews.filter((c) => !c.is_active).length },
    ],
    [crews],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return crews.filter((crew) => {
      if (filter === "active" && !crew.is_active) return false;
      if (filter === "inactive" && crew.is_active) return false;
      if (!q) return true;
      return [crew.name, crew.specialization ?? "", crew.crew_lead_name ?? "", crew.description ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [crews, filter, query]);
  const activeFilterCount =
    Number(query.trim().length > 0) +
    Number(filter !== "all");

  return (
    <div className="space-y-6 pb-6">
      <HighlightScroller />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-muted-foreground hover:text-primary" asChild>
            <Link href="/employees-crews">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to Employees &amp; Crews
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Crews</h1>
          <p className="text-sm text-muted-foreground">
            {crews.length} crew{crews.length === 1 ? "" : "s"} total
          </p>
        </div>
        <Button onClick={() => { setEditingCrew(null); setDialogOpen(true); }}>
          <Plus className="mr-1.5 size-4" />
          Add Crew
        </Button>
      </div>

      {/* Filters */}
      <div className="flex justify-end">
        <FilterDialog
          title="Crew Filters"
          description="Search and filter crews from a modal."
          activeCount={activeFilterCount}
          onClear={() => {
            setQuery("");
            setFilter("all");
          }}
        >
          <FilterDialogSection title="Search">
            <InputGroup>
              <InputGroupAddon>
                <Search className="size-4" />
              </InputGroupAddon>
              <InputGroupInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search crews, leads, specializations..."
              />
            </InputGroup>
          </FilterDialogSection>

          <FilterDialogSection title="Status">
            <div className="flex flex-wrap items-center gap-1">
              {filterTabs.map((tab) => {
                const active = filter === tab.key;
                return (
                  <FilterChip
                    key={tab.key}
                    active={active}
                    label={tab.label}
                    count={tab.count}
                    onClick={() => setFilter(tab.key)}
                  />
                );
              })}
            </div>
          </FilterDialogSection>
        </FilterDialog>
      </div>

      {/* Crew cards */}
      {filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground shadow-none">
          No crews match your search or filter.
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((crew) => (
            <Card key={crew.id} data-highlight-id={crew.id} className="p-5 shadow-none">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-semibold">{crew.name}</div>
                    {crew.specialization && (
                      <Badge variant="outline">{crew.specialization}</Badge>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {crew.crew_lead_name ? `Lead: ${crew.crew_lead_name}` : "No crew lead assigned"}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <StatusBadge active={crew.is_active} />
                  <Button
                    
                    onClick={() => { setEditingCrew(crew); setDialogOpen(true); }}
                  >
                    <Pencil className="size-3.5" />
                    Edit
                  </Button>
                </div>
              </div>

              {crew.description && (
                <p className="mt-3 text-xs text-muted-foreground">{crew.description}</p>
              )}

              <div className="mt-4 flex items-center gap-4 border-t pt-4 text-sm">
                <div>
                  <span className="text-lg font-semibold tabular-nums">{crew.member_names.length}</span>
                  <span className="ml-1 text-xs text-muted-foreground">
                    {crew.member_names.length === 1 ? "member" : "members"}
                  </span>
                </div>
              </div>

              {crew.member_names.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {crew.member_names.slice(0, 6).map((name) => (
                    <Badge key={name} variant="secondary" className="text-xs">
                      {name}
                    </Badge>
                  ))}
                  {crew.member_names.length > 6 && (
                    <Badge variant="outline" className="text-xs">
                      +{crew.member_names.length - 6} more
                    </Badge>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <CrewDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        employees={employees as unknown as EmployeeProfile[]}
        initial={editingCrew}
      />
    </div>
  );
}
