import { deleteProject } from "@/app/(jobsyte-app)/projects/actions";
import { useRouter } from "next/navigation";

import { useState, type ReactElement } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

export function DeleteProjectButton({ projectId, trigger }: { projectId: string; trigger?: ReactElement }) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  async function onDelete() {
    setIsDeleting(true);
    const res = await deleteProject(projectId);

    if (!res.ok) {
      toast.error(res.message ?? "Failed to delete project.");
      setIsDeleting(false);
      return;
    }
    toast.success("Project Deleted.");
    router.refresh();
    setIsDeleting(false);
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {trigger ?? <Button
          variant="outline"
          size="sm"
          disabled={isDeleting}
          aria-label="Delete project"
          className="gap-2 hover:bg-destructive hover:text-white cursor-pointer"
        >
          <Trash2 className="size-4" />
          <span className="hidden sm:inline">Delete</span>
        </Button>}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete This Project?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the project and all of its jobs. Any
            existing invoices will keep showing this project&apos;s details
            from the invoice snapshot, but the project itself will no longer
            appear anywhere else (dashboard, accounting, payroll, search).
            This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={isDeleting}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="cursor-pointer"
            variant="destructive"
            disabled={isDeleting}
            onClick={onDelete}
          >
            {isDeleting ? "Deleting..." : "Delete Project"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
