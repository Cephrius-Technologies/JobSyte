"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import {
  getProjectLocationSubtitle,
  getProjectStreetTitle,
} from "@/components/projects/project-location";
import type { ProjectListItem } from "@/components/projects/types";



export function ProjectsList({ projects }: { projects: ProjectListItem[] }) {
  if (projects.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-sm text-muted-foreground">
          No projects match your search.
        </div>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:w-full sm:grid-cols-[repeat(auto-fill,minmax(14rem,20rem))] sm:justify-start">
      {projects.map((p) => {
        const locationSubtitle = getProjectLocationSubtitle(p);

        return (
          <Link key={p.id} href={`/projects/${p.id}`} className="block w-full">
            <Card className="h-full p-4 hover:bg-muted/40 transition">
              <div className="font-medium">{getProjectStreetTitle(p)}</div>
              {locationSubtitle ? (
                <div className="text-sm text-muted-foreground">
                  Location: {locationSubtitle}
                </div>
              ) : null}
              <div className=" text-sm text-muted-foreground">
                Builder: {p.builder_name ?? "Unassigned"}
              </div>
              <div className="text-sm text-muted-foreground">
                Jobs: {p.job_count ?? 0}
              </div>
              {p.subdivision && (
                <div className="text-sm text-muted-foreground">
                  Subdivision: {p.subdivision}
                </div>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
