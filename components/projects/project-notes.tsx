"use client";

import { useState, useSyncExternalStore, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { addProjectNote, deleteProjectNote } from "@/app/(jobsyte-app)/projects/[id]/note-actions";
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
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PROJECT_NOTE_LENGTH, type ProjectNote } from "@/lib/projects/notes";

function subscribeToDeviceTimeChange(onChange: () => void) {
  window.addEventListener("focus", onChange);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.removeEventListener("focus", onChange);
    document.removeEventListener("visibilitychange", onChange);
  };
}

function NoteTimestamp({ createdAt }: { createdAt: string }) {
  // Keep server and hydration output identical, then format in the device's locale and timezone.
  const localTime = useSyncExternalStore(
    subscribeToDeviceTimeChange,
    () => new Date(createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
    () => "…",
  );

  return <time dateTime={createdAt}>{localTime}</time>;
}

function NoteDeleteButton({ projectId, note }: { projectId: string; note: ProjectNote }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function remove(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (isPending) return;
    setError(null);
    startTransition(async () => {
      const result = await deleteProjectNote(projectId, note.id);
      if (!result.ok) {
        setError(result.message ?? "Could not delete the note.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground hover:text-destructive"
          aria-label={`Delete note: ${note.body.slice(0, 40)}`}
        >
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this note?</AlertDialogTitle>
          <AlertDialogDescription>This permanently removes the note from the project.</AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={isPending} onClick={remove}>
            {isPending ? "Deleting..." : "Delete note"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function NotesList({ projectId, notes, currentUserId }: { projectId: string; notes: ProjectNote[]; currentUserId: string }) {
  if (notes.length === 0) {
    return <p className="text-sm text-muted-foreground">No notes yet.</p>;
  }

  return (
    <ol className="space-y-3">
      {notes.map((note) => (
        <li key={note.id} className="rounded-lg border bg-muted/20 p-3">
          <p className="whitespace-pre-wrap break-words text-sm">{note.body}</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              {note.author_id === currentUserId ? "You" : "Team member"} ·{" "}
              <NoteTimestamp createdAt={note.created_at} />
            </span>
            {note.author_id === currentUserId && <NoteDeleteButton projectId={projectId} note={note} />}
          </div>
        </li>
      ))}
    </ol>
  );
}

function NoteComposer({ projectId, jobId, label }: { projectId: string; jobId: string | null; label: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isPending || !body.trim()) return;
    setError(null);
    startTransition(async () => {
      const result = await addProjectNote(projectId, jobId, body);
      if (!result.ok) {
        setError(result.message ?? "Could not save the note.");
        return;
      }
      setBody("");
      router.refresh();
    });
  }

  return (
    <form className="space-y-2" onSubmit={submit}>
      <label htmlFor={`note-${jobId ?? "project"}`} className="text-sm font-medium">
        Add {label} note
      </label>
      <Textarea
        id={`note-${jobId ?? "project"}`}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={MAX_PROJECT_NOTE_LENGTH}
        rows={3}
        placeholder="Write a note..."
        disabled={isPending}
      />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending || !body.trim()}>
          {isPending ? "Saving..." : "Add note"}
        </Button>
      </div>
    </form>
  );
}

export function ProjectNotesCard({ projectId, notes, currentUserId }: {
  projectId: string;
  notes: ProjectNote[];
  currentUserId: string;
}) {
  return (
    <Card id="project-notes" className="order-3 gap-4 p-4 sm:p-5 lg:order-none">
      <div>
        <h2 className="text-sm font-semibold">Project notes</h2>
        <p className="text-xs text-muted-foreground">Updates shared with your company.</p>
      </div>
      <NotesList projectId={projectId} notes={notes} currentUserId={currentUserId} />
      <div className="border-t pt-4">
        <NoteComposer projectId={projectId} jobId={null} label="project" />
      </div>
    </Card>
  );
}

export function JobNotesDialog({ open, onOpenChange, projectId, jobId, jobTitle, notes, currentUserId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  jobId: string;
  jobTitle: string;
  notes: ProjectNote[];
  currentUserId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Notes for {jobTitle}</DialogTitle>
          <DialogDescription>Updates for this job within the project.</DialogDescription>
        </DialogHeader>
        <NotesList projectId={projectId} notes={notes} currentUserId={currentUserId} />
        <div className="border-t pt-4">
          <NoteComposer projectId={projectId} jobId={jobId} label="job" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
