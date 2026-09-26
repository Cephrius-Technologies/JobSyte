import { getProjectLocationSubtitle, getProjectStreetTitle } from "@/components/projects/project-location";
import type { ProjectListItem } from "@/components/projects/types";

export type ProjectSortKey = "address" | "group" | "progress" | "status" | "updated";
export type ProjectSortDirection = "asc" | "desc";
export type ProjectSort = { key: ProjectSortKey; direction: ProjectSortDirection };

const collator = new Intl.Collator("en-US", { numeric: true, sensitivity: "base" });
const statusOrder: Record<ProjectListItem["status"], number> = {
  "not-started": 0,
  active: 1,
  completed: 2,
};

export function nextProjectSort(current: ProjectSort, key: ProjectSortKey): ProjectSort {
  if (current.key === key) {
    return { key, direction: current.direction === "asc" ? "desc" : "asc" };
  }
  return { key, direction: key === "updated" ? "desc" : "asc" };
}

export function sortProjects(projects: ProjectListItem[], sort: ProjectSort) {
  const multiplier = sort.direction === "asc" ? 1 : -1;

  return [...projects].sort((a, b) => {
    if (sort.key === "updated") {
      const aDate = a.last_activity_at;
      const bDate = b.last_activity_at;
      if (!aDate && bDate) return 1;
      if (aDate && !bDate) return -1;
      const result = collator.compare(aDate ?? "", bDate ?? "") * multiplier;
      return result || collator.compare(a.id, b.id);
    }

    let result = 0;
    switch (sort.key) {
      case "address":
        result = collator.compare(getProjectStreetTitle(a), getProjectStreetTitle(b)) ||
          collator.compare(getProjectLocationSubtitle(a), getProjectLocationSubtitle(b));
        break;
      case "group":
        result = collator.compare(a.subdivision ?? "", b.subdivision ?? "") ||
          collator.compare(a.builder_name ?? "", b.builder_name ?? "");
        break;
      case "progress": {
        const aRate = a.job_count ? (a.job_count - a.open_job_count) / a.job_count : 0;
        const bRate = b.job_count ? (b.job_count - b.open_job_count) / b.job_count : 0;
        result = aRate - bRate || (a.job_count - a.open_job_count) - (b.job_count - b.open_job_count);
        break;
      }
      case "status":
        result = statusOrder[a.status] - statusOrder[b.status];
        break;
    }

    return result * multiplier || collator.compare(a.id, b.id);
  });
}
