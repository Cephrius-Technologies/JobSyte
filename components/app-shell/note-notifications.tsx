"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCompany } from "@/lib/company-context";
import { createClient } from "@/lib/supabase/client";

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

export function NoteNotifications({ userId }: { userId: string }) {
  const { activeCompany } = useCompany();
  const companyId = activeCompany?.id;
  const supabase = useMemo(() => createClient(), []);
  const requestId = useRef(0);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NoteNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    const currentRequest = ++requestId.current;
    const [recent, unread] = await Promise.all([
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
    ]);
    if (currentRequest !== requestId.current) return;
    if (recent.error || unread.error) {
      setError(true);
      return;
    }
    setItems((recent.data ?? []) as NoteNotification[]);
    setUnreadCount(unread.count ?? 0);
    setError(false);
  }, [companyId, supabase, userId]);

  useEffect(() => {
    const initial = window.setTimeout(() => {
      setItems([]);
      setUnreadCount(0);
      void refresh();
    }, 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 30000);
    const onFocus = () => { void refresh(); };
    window.addEventListener("focus", onFocus);
    return () => {
      requestId.current += 1;
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
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

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) void refresh();
    }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-9" aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}>
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0">
        <div className="border-b px-4 py-3 text-sm font-semibold">Notifications</div>
        {error ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">Could not load notifications.</p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">No note notifications yet.</p>
        ) : (
          <div className="max-h-96 divide-y overflow-y-auto">
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
        )}
      </PopoverContent>
    </Popover>
  );
}
