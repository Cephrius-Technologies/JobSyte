import type { ReactNode } from "react";
import { FolderOpen } from "lucide-react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <FolderOpen className="mb-4 size-6 text-muted-foreground" aria-hidden="true" />
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
