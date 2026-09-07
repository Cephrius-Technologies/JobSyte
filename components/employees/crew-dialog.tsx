"use client";

// Onboarding: crew create/edit form. Employee choices come from the current
// company roster loaded by the employees-crews pages and persisted through
// `app/(jobsyte-app)/(app)/employees-crews/actions.ts`.
import { useEffect, useMemo, useState, useTransition } from "react";
import { Settings, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { createCrew, updateCrew } from "@/app/(jobsyte-app)/employees-crews/actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  CREW_SPECIALIZATIONS,
  type CrewProfile,
  type EmployeeProfile,
} from "./types";

export function CrewDialog({
  open,
  onOpenChange,
  employees,
  initial,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  employees: EmployeeProfile[];
  initial?: CrewProfile | null;
}) {
  const isEditing = Boolean(initial);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(
    initial?.description ?? initial?.notes ?? "",
  );
  const [crewLeadId, setCrewLeadId] = useState(initial?.crew_lead_id ?? "");
  const [specialization, setSpecialization] = useState(
    initial?.specialization ?? "",
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [memberIds, setMemberIds] = useState<string[]>(
    initial?.member_ids ?? [],
  );

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.is_active),
    [employees],
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: hydrate form fields when dialog opens with a new entity
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? initial?.notes ?? "");
    setCrewLeadId(initial?.crew_lead_id ?? "");
    setSpecialization(initial?.specialization ?? "");
    setIsActive(initial?.is_active ?? true);
    setMemberIds(initial?.member_ids ?? []);
  }, [open, initial]);

  function toggleMember(employeeId: string) {
    setMemberIds((prev) =>
      prev.includes(employeeId)
        ? prev.filter((id) => id !== employeeId)
        : [...prev, employeeId],
    );
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const fd = new FormData();
    if (initial?.id) fd.set("crew_id", initial.id);
    fd.set("name", name);
    fd.set("description", description);
    fd.set("crew_lead_id", crewLeadId);
    fd.set("specialization", specialization);
    fd.set("is_active", String(isActive));
    memberIds.forEach((id) => fd.append("member_ids", id));

    startTransition(async () => {
      const result = isEditing ? await updateCrew(fd) : await createCrew(fd);
      if (!result.ok) {
        toast.error(result.message ?? "Failed to save crew.");
        return;
      }
      toast.success(isEditing ? "Crew updated." : "Crew created.");
      onOpenChange(false);
    });
  }

  const selectedCount = memberIds.length;
  const warnNoLead =
    name.length > 0 && memberIds.length > 1 && !crewLeadId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] sm:max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>
            {isEditing ? `Edit ${initial?.name}` : "New Crew"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <Tabs
            defaultValue="details"
            className="flex min-h-0 flex-1 flex-col"
            style={{ gap: 0 }}
          >
            <div className="shrink-0 border-b px-6">
              <TabsList variant="line" className="h-10">
                <TabsTrigger value="details" className="gap-1.5">
                  <Settings className="size-3.5" />
                  Details
                </TabsTrigger>
                <TabsTrigger value="members" className="gap-1.5">
                  <Users className="size-3.5" />
                  Members
                  {selectedCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="ml-1 h-4 px-1.5 text-xs"
                    >
                      {selectedCount}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* ── Details ── */}
              <TabsContent value="details" className="m-0 space-y-4 p-6">
                <div className="space-y-1.5">
                  <Label htmlFor="crew-name">Crew Name *</Label>
                  <Input
                    id="crew-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Alpha Framing Crew"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Crew Lead</Label>
                  <Select
                    value={crewLeadId || "__none__"}
                    onValueChange={(v) =>
                      setCrewLeadId(v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select crew lead…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        — No lead assigned —
                      </SelectItem>
                      {activeEmployees.map((emp) => (
                        <SelectItem key={emp.id} value={emp.id}>
                          {emp.name}
                          {emp.role && (
                            <span className="text-muted-foreground">
                              {" "}
                              · {emp.role}
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {warnNoLead && (
                    <p className="text-xs text-amber-600">
                      No crew lead assigned — consider adding one for better
                      accountability.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label>Specialization</Label>
                  <Select
                    value={specialization || "__none__"}
                    onValueChange={(v) =>
                      setSpecialization(v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select specialization…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not specified —</SelectItem>
                      {CREW_SPECIALIZATIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="crew-desc">Description</Label>
                  <Textarea
                    id="crew-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Crew responsibilities, notes, etc."
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Active Status</p>
                    <p className="text-xs text-muted-foreground">
                      Inactive crews won&apos;t appear in job assignments
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </TabsContent>

              {/* ── Members ── */}
              <TabsContent value="members" className="m-0 p-6">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {selectedCount === 0
                      ? "No members selected"
                      : `${selectedCount} member${selectedCount !== 1 ? "s" : ""} selected`}
                  </p>
                  {selectedCount > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-auto py-0.5 text-xs"
                      onClick={() => setMemberIds([])}
                    >
                      Clear all
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {activeEmployees.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">
                      No active employees available.
                    </p>
                  ) : (
                    activeEmployees.map((emp) => {
                      const isSelected = memberIds.includes(emp.id);
                      const isLead = emp.id === crewLeadId;
                      return (
                        <label
                          key={emp.id}
                          className={cn(
                            "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/50",
                            isSelected &&
                              "border-border bg-primary/5 hover:bg-muted",
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleMember(emp.id)}
                          />
                          <Avatar size="sm">
                            <AvatarFallback>
                              {emp.name.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {emp.name}
                            </p>
                            {(emp.job_title || emp.role) && (
                              <p className="text-xs text-muted-foreground truncate">
                                {emp.job_title ?? emp.role}
                              </p>
                            )}
                          </div>
                          {isLead && (
                            <Badge variant="secondary" className="shrink-0 text-xs">
                              Lead
                            </Badge>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>

          <div className="shrink-0 border-t px-6 py-4">
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving…"
                  : isEditing
                    ? "Save Changes"
                    : "Create Crew"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
