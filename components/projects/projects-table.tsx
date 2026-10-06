"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import {
  getProjectLocationSubtitle,
  getProjectStreetTitle,
} from "@/components/projects/project-location";
import type { ProjectListItem } from "@/components/projects/types";

export function ProjectsTable({ projects }: { projects: ProjectListItem[] }) {
  const router = useRouter();

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
    <Card className="p-3 sm:p-5">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="px-2 py-3">Project Address</TableHead>
            <TableHead className="px-2 py-3">Builder</TableHead>
            <TableHead className="px-2 py-3">Subdivision</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.map((project) => {
            const locationSubtitle = getProjectLocationSubtitle(project);

            return (
              <TableRow
                key={project.id}
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <TableCell className="px-2 py-3">
                  <Link
                    href={`/projects/${project.id}`}
                    className="font-medium hover:underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {getProjectStreetTitle(project)}
                  </Link>
                  {locationSubtitle ? (
                    <div className="text-xs text-muted-foreground">
                      {locationSubtitle}
                    </div>
                  ) : null}
                </TableCell>
                <TableCell className="px-2 py-3">
                  {project.builder_name ?? "Unassigned"}
                </TableCell>
                <TableCell className="px-2 py-3">
                  {project.subdivision ?? "-"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
