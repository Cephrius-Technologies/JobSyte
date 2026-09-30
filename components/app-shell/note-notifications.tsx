"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";
import { getLocalDateKey } from "@/components/jobs/job-status";

type NoteNotification = {
  id: string;
  project_id: string;
  job_id: string | null;
  project_label: string;
  job_label: string | null;
  preview: string;
  created_at: string;
  read_at: string | null;
};

type OverdueJob = {
  id: string;
  title: string;
  project_id: string;
  scheduled_completion: string;
};

export function NoteNotifications({ userId }: { userId: string }) {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;
  const supabase = useMemo(() => createClient(), []);
  const requestId = useRef(0);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NoteNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [overdueJobs, setOverdueJobs] = useState<OverdueJob[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [notesError, setNotesError] = useState(false);
  const [overdueError, setOverdueError] = useState(false);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    const currentRequest = ++requestId.current;
    const [recent, unread, overdue] = await Promise.all([
      supabase.from("note_notifications")
        .select("id, project_id, job_id, project_label, job_label, preview, created_at, read_at")
        .eq("company_id", companyId)
        .eq("recipient_id", userId)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("note_notifications")
        .select("id", { count: "exact", head: true })
        .eq("company_id", companyId)
        .eq("recipient_id", userId)
        .is("read_at", null),
      supabase.from("jobs")
        .select("id, title, project_id, scheduled_completion", { count: "exact" })
        .eq("company_id", companyId)
        .eq("is_completed", false)
        .is("deleted_at", null)
        .lt("scheduled_completion", getLocalDateKey(new Date()))
        .order("scheduled_completion", { ascending: true })
        .limit(25),
    ]);
    if (currentRequest !== requestId.current) return;
    if (recent.error || unread.error) {
      setNotesError(true);
    } else {
      setItems((recent.data ?? []) as NoteNotification[]);
      setUnreadCount(unread.count ?? 0);
      setNotesError(false);
    }
    if (overdue.error) {
      setOverdueError(true);
    } else {
      setOverdueJobs((overdue.data ?? []) as OverdueJob[]);
      setOverdueCount(overdue.count ?? 0);
      setOverdueError(false);
    }
  }, [companyId, supabase, userId]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setItems([]);
      setUnreadCount(0);
      setOverdueJobs([]);
      setOverdueCount(0);
      void refresh();
    }, 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    window.addEventListener("jobsyte:jobs-changed", onFocus);
    return () => {
      requestId.current += 1;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("jobsyte:jobs-changed", onFocus);
    };
  }, [refresh]);

  async function openNotification(notification: NoteNotification) {
    if (!companyId) return;
    if (!notification.read_at) {
      const { error: updateError } = await supabase.from("note_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notification.id)
        .eq("company_id", companyId)
        .eq("recipient_id", userId);
      if (!updateError) {
        setItems((current) => current.map((item) => item.id === notification.id
          ? { ...item, read_at: new Date().toISOString() }
          : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      }
    }
    setOpen(false);
    const destination = notification.job_id
      ? `/projects/${notification.project_id}?noteJob=${encodeURIComponent(notification.job_id)}`
      : `/projects/${notification.project_id}#project-notes`;
    router.push(destination);
  }

  const totalCount = unreadCount + overdueCount;
  const countLabel = [
    unreadCount ? `${unreadCount} unread` : null,
    overdueCount ? `${overdueCount} overdue job${overdueCount === 1 ? "" : "s"}` : null,
  ].filter(Boolean).join(", ");

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) void refresh();
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-9" aria-label={`Notifications${countLabel ? `, ${countLabel}` : ""}`}>
          <Bell className="size-4" />
          {totalCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Notifications</div>
        <div className="max-h-96 overflow-y-auto">
          {overdueError && <p className="px-4 py-3 text-xs text-destructive">Could not load overdue jobs.</p>}
          {overdueJobs.length > 0 && (
            <section aria-label="Overdue jobs">
              <div className="sticky top-0 flex items-center gap-2 border-b bg-popover px-4 py-2 text-xs font-semibold text-destructive">
                <AlertTriangle className="size-3.5" /> Overdue jobs · {overdueCount}
              </div>
              <div className="divide-y">
                {overdueJobs.map((job) => (
                  <button key={job.id} type="button" className="flex w-full flex-col gap-0.5 px-4 py-3 text-left hover:bg-muted/50" onClick={() => {
                    setOpen(false);
                    router.push(`/projects/${job.project_id}`);
                  }}>
                    <span className="truncate text-sm font-medium">{job.title}</span>
                    <span className="text-xs text-muted-foreground">Due {new Date(`${job.scheduled_completion}T00:00:00`).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                  </button>
                ))}
                {overdueCount > overdueJobs.length && (
                  <button type="button" className="w-full px-4 py-3 text-left text-xs font-medium text-primary hover:bg-muted/50" onClick={() => {
                    setOpen(false);
                    router.push("/jobs");
                  }}>View all jobs ({overdueCount} overdue)</button>
                )}
              </div>
            </section>
          )}
          {notesError && <p className="px-4 py-3 text-xs text-destructive">Could not load note notifications.</p>}
          {items.length > 0 && (
            <section aria-label="Recent notes">
              <div className="sticky top-0 border-y bg-popover px-4 py-2 text-xs font-semibold">Recent notes</div>
              <div className="divide-y">
                {items.map((notification) => (
              <button
                key={notification.id}
                type="button"
                className="flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-muted/50"
                onClick={() => void openNotification(notification)}
              >
                <span className="flex w-full items-start gap-2 text-sm font-medium">
                  {!notification.read_at && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
                  <span className="min-w-0 truncate">
                    New {notification.job_id ? "job" : "project"} note · {notification.job_label ?? notification.project_label}
                  </span>
                </span>
                <span className="line-clamp-2 break-words text-xs text-muted-foreground">{notification.preview}</span>
                <time dateTime={notification.created_at} className="text-xs text-muted-foreground">
                  {new Date(notification.created_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </time>
              </button>
                ))}
              </div>
            </section>
          )}
          {!overdueError && !notesError && overdueJobs.length === 0 && items.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">No notifications right now.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
