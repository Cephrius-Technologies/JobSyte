import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import type { ProjectSort, ProjectSortKey } from "@/components/projects/project-sort";

export function ProjectSortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: ProjectSortKey;
  sort: ProjectSort;
  onSort: (key: ProjectSortKey) => void;
}) {
  const active = sort.key === sortKey;
  const Icon = !active ? ArrowUpDown : sort.direction === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead aria-sort={active ? sort.direction === "asc" ? "ascending" : "descending" : "none"}>
      <button
        type="button"
        className="inline-flex min-h-9 items-center gap-1.5 rounded-md text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      </button>
    </TableHead>
  );
}
