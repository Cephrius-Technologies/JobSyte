"use client";

// Onboarding: employee profile form plus employee-app credential issuing. The
// server actions are in `app/(jobsyte-app)/(app)/employees-crews/actions.ts`;
// the field employee login consumer is in `employee-app/app/api/auth/login/route.ts`.
import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, Building2, Copy, KeyRound, Phone, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  createEmployee,
  resetEmployeePassword,
  updateEmployee,
} from "@/app/(jobsyte-app)/employees-crews/actions";
import { toast } from "sonner";
import {
  EMPLOYMENT_TYPE_LABELS,
  PAY_TYPE_LABELS,
  PAYMENT_METHOD_LABELS,
  type EmployeeProfile,
  type EmploymentType,
  type PayType,
  type PaymentMethod,
} from "./types";

const LOGIN_HANDLE_RE = /^[a-z0-9_-]{3,32}$/;

export function EmployeeDialog({
  open,
  onOpenChange,
  initial,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  initial?: EmployeeProfile | null;
}) {
  const isEditing = Boolean(initial);
  const [isPending, startTransition] = useTransition();

  // Profile
  const [name, setName] = useState(initial?.name ?? "");
  const [loginHandle, setLoginHandle] = useState(initial?.login_handle ?? "");
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [revealedHandle, setRevealedHandle] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState(initial?.job_title ?? "");
  const [role, setRole] = useState(initial?.role ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">(
    initial?.employment_type ?? "",
  );
  const [isActive, setIsActive] = useState(initial?.is_active ?? true);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  // Contact
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");

  // Work & Pay
  const [payType, setPayType] = useState<PayType | "">(initial?.pay_type ?? "");
  const [hourlyRate, setHourlyRate] = useState(
    initial?.hourly_rate?.toString() ?? "",
  );
  const [hireDate, setHireDate] = useState(initial?.hire_date ?? "");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | "">(
    initial?.payment_method ?? "",
  );
  const [cardLastFour, setCardLastFour] = useState(
    initial?.payment_details?.last_four ?? "",
  );
  const [epayPlatform, setEpayPlatform] = useState(
    initial?.payment_details?.platform ?? "",
  );
  const [epayReference, setEpayReference] = useState(
    initial?.payment_details?.reference ?? "",
  );
  const [wireRouting, setWireRouting] = useState(
    initial?.payment_details?.routing ?? "",
  );
  const [wireAccount, setWireAccount] = useState(
    initial?.payment_details?.account ?? "",
  );

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: hydrate form fields when dialog opens with a new entity
    setName(initial?.name ?? "");
    setLoginHandle(initial?.login_handle ?? "");
    setJobTitle(initial?.job_title ?? "");
    setRole(initial?.role ?? "");
    setEmploymentType(initial?.employment_type ?? "");
    setIsActive(initial?.is_active ?? true);
    setNotes(initial?.notes ?? "");
    setEmail(initial?.email ?? "");
    setPhone(initial?.phone ?? "");
    setAddress(initial?.address ?? "");
    setPayType(initial?.pay_type ?? "");
    setHourlyRate(initial?.hourly_rate?.toString() ?? "");
    setHireDate(initial?.hire_date ?? "");
    setPaymentMethod(initial?.payment_method ?? "");
    setCardLastFour(initial?.payment_details?.last_four ?? "");
    setEpayPlatform(initial?.payment_details?.platform ?? "");
    setEpayReference(initial?.payment_details?.reference ?? "");
    setWireRouting(initial?.payment_details?.routing ?? "");
    setWireAccount(initial?.payment_details?.account ?? "");
  }, [open, initial]);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const fd = new FormData();
    if (initial?.id) fd.set("employee_id", initial.id);
    if (!isEditing) fd.set("login_handle", loginHandle);
    fd.set("name", name);
    fd.set("job_title", jobTitle);
    fd.set("role", role);
    fd.set("employment_type", employmentType);
    fd.set("is_active", String(isActive));
    fd.set("notes", notes);
    fd.set("email", email);
    fd.set("phone", phone);
    fd.set("address", address);
    fd.set("pay_type", payType);
    fd.set("hourly_rate", hourlyRate);
    fd.set("hire_date", hireDate);
    fd.set("payment_method", paymentMethod);
    if (paymentMethod === "card") fd.set("pd_last_four", cardLastFour);
    if (paymentMethod === "epay") {
      fd.set("pd_platform", epayPlatform);
      fd.set("pd_reference", epayReference);
    }
    if (paymentMethod === "wire") {
      fd.set("pd_routing", wireRouting);
      fd.set("pd_account", wireAccount);
    }

    startTransition(async () => {
      const result = isEditing
        ? await updateEmployee(fd)
        : await createEmployee(fd);

      if (!result.ok) {
        toast.error(result.message ?? "Failed to save employee.");
        return;
      }

      if (
        !isEditing &&
        "password" in result &&
        typeof result.password === "string" &&
        result.password
      ) {
        setRevealedPassword(result.password);
        setRevealedHandle(
          "loginHandle" in result && typeof result.loginHandle === "string"
            ? result.loginHandle
            : loginHandle,
        );
        toast.success("Employee created.");
        return; // keep dialog open until owner confirms password copy
      }

      toast.success(isEditing ? "Employee updated." : "Employee created.");
      onOpenChange(false);
    });
  }

  const showRateField = payType === "hourly" || payType === "salary";
  const rateLabel = payType === "salary" ? "Annual Salary ($)" : "Hourly Rate ($)";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] sm:max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12">
          <DialogTitle>
            {isEditing ? `Edit ${initial?.name}` : "New Employee"}
          </DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <Tabs
            defaultValue="profile"
            className="flex min-h-0 flex-1 flex-col"
            style={{ gap: 0 }}
          >
            <div className="shrink-0 border-b px-6">
              <TabsList variant="line" className="h-10">
                <TabsTrigger value="profile" className="gap-1.5">
                  <User className="size-3.5" />
                  Profile
                </TabsTrigger>
                <TabsTrigger value="contact" className="gap-1.5">
                  <Phone className="size-3.5" />
                  Contact
                </TabsTrigger>
                <TabsTrigger value="work" className="gap-1.5">
                  <Building2 className="size-3.5" />
                  Work &amp; Pay
                </TabsTrigger>
                <TabsTrigger value="payment" className="gap-1.5">
                  <Wallet className="size-3.5" />
                  Payment
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* ── Profile ── */}
              <TabsContent value="profile" className="m-0 space-y-4 p-6">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-login-handle">
                    Login Handle{!isEditing && " *"}
                  </Label>
                  <Input
                    id="emp-login-handle"
                    value={loginHandle}
                    onChange={(e) =>
                      setLoginHandle(e.target.value.toLowerCase().trim())
                    }
                    placeholder="e.g. john_smith"
                    disabled={isEditing}
                    autoComplete="off"
                  />
                  {isEditing ? (
                    <p className="text-xs text-muted-foreground">
                      Login handle cannot be changed.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Used to sign in at employee.jobsyte.co. Lowercase letters,
                      numbers, underscores, hyphens. 3\u201332 chars. Must be unique.
                    </p>
                  )}
                  {!isEditing &&
                    loginHandle.length > 0 &&
                    !LOGIN_HANDLE_RE.test(loginHandle) && (
                      <p className="text-xs text-destructive">
                        Login handle must be 3\u201332 chars: lowercase letters,
                        numbers, underscores, hyphens.
                      </p>
                    )}
                  {isEditing && initial?.id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      disabled={isPending}
                      onClick={() => {
                        startTransition(async () => {
                          const result = await resetEmployeePassword(initial.id);
                          if (!result.ok) {
                            toast.error(result.message);
                            return;
                          }
                          setRevealedPassword(result.password);
                          setRevealedHandle(initial.login_handle ?? "");
                          toast.success("Password reset.");
                        });
                      }}
                    >
                      <KeyRound className="size-3.5" />
                      Reset Password
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-name">Full Name *</Label>
                  <Input
                    id="emp-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. John Smith"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-job-title">Job Title</Label>
                    <Input
                      id="emp-job-title"
                      value={jobTitle}
                      onChange={(e) => setJobTitle(e.target.value)}
                      placeholder="e.g. Senior Framer"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-role">Trade / Specialty</Label>
                    <Input
                      id="emp-role"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Electrician"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Employment Type</Label>
                  <Select
                    value={employmentType || "__none__"}
                    onValueChange={(v) =>
                      setEmploymentType(
                        v === "__none__" ? "" : (v as EmploymentType),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not specified —</SelectItem>
                      {(
                        Object.entries(EMPLOYMENT_TYPE_LABELS) as [
                          EmploymentType,
                          string,
                        ][]
                      ).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-notes">Notes</Label>
                  <Textarea
                    id="emp-notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Any additional notes about this employee…"
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm font-medium">Active Status</p>
                    <p className="text-xs text-muted-foreground">
                      Inactive employees won&apos;t appear in job assignments
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>
              </TabsContent>

              {/* ── Contact ── */}
              <TabsContent value="contact" className="m-0 space-y-4 p-6">
                <div className="space-y-1.5">
                  <Label htmlFor="emp-email">Email Address</Label>
                  <Input
                    id="emp-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-phone">Phone Number</Label>
                  <Input
                    id="emp-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 000-0000"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emp-address">Address</Label>
                  <Textarea
                    id="emp-address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    placeholder="123 Main St, City, State 00000"
                  />
                </div>
              </TabsContent>

              {/* ── Work & Pay ── */}
              <TabsContent value="work" className="m-0 space-y-4 p-6">
                <div className="space-y-1.5">
                  <Label>Default Pay Type</Label>
                  <Select
                    value={payType || "__none__"}
                    onValueChange={(v) =>
                      setPayType(v === "__none__" ? "" : (v as PayType))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select pay type…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not specified —</SelectItem>
                      {(
                        Object.entries(PAY_TYPE_LABELS) as [PayType, string][]
                      ).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {showRateField && (
                  <div className="space-y-1.5">
                    <Label htmlFor="emp-rate">{rateLabel}</Label>
                    <Input
                      id="emp-rate"
                      type="text"
                      inputMode="decimal"
                      value={hourlyRate}
                      onChange={(e) => setHourlyRate(e.target.value)}
                      placeholder="0.00"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="emp-hire-date">Hire Date</Label>
                  <Input
                    id="emp-hire-date"
                    type="date"
                    value={hireDate}
                    onChange={(e) => setHireDate(e.target.value)}
                  />
                </div>
              </TabsContent>

              {/* ── Payment ── */}
              <TabsContent value="payment" className="m-0 space-y-4 p-6">
                <div className="space-y-1.5">
                  <Label>Preferred Payment Method</Label>
                  <Select
                    value={paymentMethod || "__none__"}
                    onValueChange={(v) =>
                      setPaymentMethod(
                        v === "__none__" ? "" : (v as PaymentMethod),
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select method…" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— Not specified —</SelectItem>
                      {(
                        Object.entries(PAYMENT_METHOD_LABELS) as [
                          PaymentMethod,
                          string,
                        ][]
                      ).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {paymentMethod === "card" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="pd-last-four">Card Last 4 Digits</Label>
                    <Input
                      id="pd-last-four"
                      maxLength={4}
                      inputMode="numeric"
                      value={cardLastFour}
                      onChange={(e) =>
                        setCardLastFour(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="0000"
                      className="max-w-32"
                    />
                  </div>
                )}

                {paymentMethod === "epay" && (
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="pd-epay-platform">Platform</Label>
                      <Input
                        id="pd-epay-platform"
                        value={epayPlatform}
                        onChange={(e) => setEpayPlatform(e.target.value)}
                        placeholder="e.g. Zelle, Venmo, Cash App"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pd-epay-reference">Handle / Reference</Label>
                      <Input
                        id="pd-epay-reference"
                        value={epayReference}
                        onChange={(e) => setEpayReference(e.target.value)}
                        placeholder="e.g. @johnsmith or phone number"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === "wire" && (
                  <div className="space-y-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="pd-routing">Routing Number</Label>
                      <Input
                        id="pd-routing"
                        value={wireRouting}
                        onChange={(e) => setWireRouting(e.target.value)}
                        placeholder="9-digit routing number"
                        maxLength={9}
                        inputMode="numeric"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="pd-account">Account Number</Label>
                      <Input
                        id="pd-account"
                        value={wireAccount}
                        onChange={(e) => setWireAccount(e.target.value)}
                        placeholder="Account number"
                        inputMode="numeric"
                      />
                    </div>
                  </div>
                )}

                {!paymentMethod && (
                  <p className="text-sm text-muted-foreground">
                    Select a payment method to configure payment details.
                  </p>
                )}
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
              <Button
                type="submit"
                disabled={
                  isPending ||
                  (!isEditing &&
                    (!loginHandle || !LOGIN_HANDLE_RE.test(loginHandle)))
                }
              >
                {isPending
                  ? "Saving\u2026"
                  : isEditing
                    ? "Save Changes"
                    : "Create Employee"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>

      <Dialog
        open={revealedPassword !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRevealedPassword(null);
            setRevealedHandle(null);
            if (!isEditing) onOpenChange(false);
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-600" />
              Employee password ready
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <p className="text-sm font-medium text-destructive">
              This password is shown once. Copy it now \u2014 it cannot be
              retrieved later.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={revealedPassword ?? ""}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!revealedPassword) return;
                  await navigator.clipboard.writeText(revealedPassword);
                  toast.success("Copied.");
                }}
                aria-label="Copy password"
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
            {revealedHandle && (
              <p className="text-xs text-muted-foreground">
                Login handle:{" "}
                <span className="font-mono">{revealedHandle}</span>
              </p>
            )}
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                setRevealedPassword(null);
                setRevealedHandle(null);
                if (!isEditing) onOpenChange(false);
              }}
            >
              Done
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
