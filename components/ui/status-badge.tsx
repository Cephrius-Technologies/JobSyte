import type { ComponentProps } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const tones = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-destructive",
  info: "bg-info-muted text-info",
  neutral: "bg-muted text-muted-foreground",
};

export function StatusBadge({ tone = "neutral", className, ...props }: ComponentProps<typeof Badge> & {
  tone?: keyof typeof tones;
}) {
  return <Badge variant="secondary" className={cn("border-transparent rounded-md px-2 py-0.5 font-medium", tones[tone], className)} {...props} />;
}
