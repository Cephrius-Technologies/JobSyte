import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

export function StatCard({ label, value, meta }: { label: string; value: ReactNode; meta?: ReactNode }) {
  return (
    <Card className="min-w-0 h-full gap-2 p-4 sm:p-5">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight tabular-nums break-words sm:text-2xl">{value}</div>
      {meta && <div className="text-xs leading-relaxed text-muted-foreground">{meta}</div>}
    </Card>
  );
}
