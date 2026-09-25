"use client";

import { useState } from "react";
import { MoreHorizontal, Plus } from "lucide-react";
import { NewProjectDialog } from "@/components/projects/new-project-dialog";
import type { LookupItem } from "@/components/projects/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type BuilderGroupActionsMenuProps = {
  builders: LookupItem[];
  subdivisions: LookupItem[];
  builderId?: string;
  subdivisionId?: string;
  builderLabel: string;
};

export function BuilderGroupActionsMenu({
  builders,
  subdivisions,
  builderId,
  subdivisionId,
  builderLabel,
}: BuilderGroupActionsMenuProps) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full gap-2 sm:w-auto"
            aria-label={`Actions for ${builderLabel}`}
            onClick={(event) => event.stopPropagation()}
          >
            <MoreHorizontal className="size-4" />
            <span className="sm:hidden">Actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-44"
          onClick={(event) => event.stopPropagation()}
        >
          <DropdownMenuItem
            className="cursor-pointer"
            onSelect={(event) => {
              event.preventDefault();
              setNewProjectOpen(true);
            }}
          >
            <Plus className="size-4" />
            Add Street
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NewProjectDialog
        open={newProjectOpen}
        onOpenChange={setNewProjectOpen}
        initialBuilders={builders}
        initialSubdivisions={subdivisions}
        initialBuilderId={builderId}
        initialSubdivisionId={subdivisionId}
      />
    </>
  );
}
