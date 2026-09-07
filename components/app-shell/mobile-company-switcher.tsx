"use client";

import * as React from "react";
import { Check, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useCompany, type Company } from "@/lib/company-context";
import { createCompany, deleteCompany } from "@/app/(jobsyte-app)/settings/company-actions";

import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

function companyInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function MobileCompanySwitcher() {
  const router = useRouter();
  const { companies, activeCompany, setActiveCompanyId } = useCompany();
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [newAddress, setNewAddress] = React.useState("");
  const [newPhone, setNewPhone] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Company | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  async function onDeleteCompany() {
    if (!deleteTarget) return;

    setDeleting(true);
    const result = await deleteCompany(deleteTarget.id);
    setDeleting(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(`"${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
    setDrawerOpen(false);

    if (result.fallbackCompanyId) {
      setActiveCompanyId(result.fallbackCompanyId);
    }
    router.refresh();
  }

  function openDeleteConfirmation(company: Company) {
    setDrawerOpen(false);
    setTimeout(() => setDeleteTarget(company), 150);
  }

  async function onCreateCompany() {
    const name = newName.trim();
    if (!name) return;

    setCreating(true);
    const result = await createCompany(name, newAddress, newPhone);
    setCreating(false);

    if (!result.ok) {
      toast.error(result.message);
      return;
    }

    toast.success(`"${name}" created.`);
    setDialogOpen(false);
    setNewName("");
    setNewAddress("");
    setNewPhone("");

    setActiveCompanyId(result.companyId);
    router.refresh();
  }

  function onSwitch(company: Company) {
    setActiveCompanyId(company.id);
    setDrawerOpen(false);
    router.refresh();
  }

  function openCreateDialog() {
    setDrawerOpen(false);
    // Small delay so the drawer closes before the dialog opens
    setTimeout(() => setDialogOpen(true), 150);
  }

  if (!activeCompany) return null;

  return (
    <>
      {/* Trigger: company initials badge */}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex size-9 items-center justify-center rounded-lg border border-border bg-primary text-primary-foreground text-xs font-bold shrink-0 hover:bg-primary/90 transition-colors"
        aria-label={`Switch company — ${activeCompany.name}`}
      >
        {companyInitials(activeCompany.name)}
      </button>

      {/* Bottom drawer with company list */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Switch Company</DrawerTitle>
          </DrawerHeader>

          <div className="px-4 pb-2 space-y-1">
            {companies.map((company) => {
              const isActive = company.id === activeCompany.id;
              return (
                <div key={company.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSwitch(company)}
                    className={cn(
                      "flex flex-1 min-w-0 items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted",
                    )}
                  >
                    <div
                      className={cn(
                        "flex size-10 items-center justify-center rounded-lg text-sm font-bold shrink-0",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "border bg-muted text-muted-foreground",
                      )}
                    >
                      {companyInitials(company.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {company.name}
                      </div>
                      <div className="text-xs text-muted-foreground capitalize">
                        {company.role}
                      </div>
                    </div>
                    {isActive && (
                      <Check className="size-5 shrink-0 text-primary" />
                    )}
                  </button>
                  {company.role === "owner" && (
                    <button
                      type="button"
                      className="flex size-10 items-center justify-center rounded-lg shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                      onClick={() => openDeleteConfirmation(company)}
                      aria-label={`Delete ${company.name}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <DrawerFooter>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={openCreateDialog}
            >
              <Plus className="size-4" />
              Add Company
            </Button>
            <DrawerClose asChild>
              <Button variant="ghost" className="w-full">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Create Company Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a New Company</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="mobile-new-company-name">Company Name</Label>
              <Input
                id="mobile-new-company-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Acme Construction LLC"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-new-company-address">
                Address{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="mobile-new-company-address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="123 Main St, City, ST 12345"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mobile-new-company-phone">
                Phone{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Input
                id="mobile-new-company-phone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={onCreateCompany}
              disabled={creating || !newName.trim()}
            >
              {creating ? "Creating..." : "Create Company"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Company Confirmation */}
      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Company</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>
              ? This will permanently delete all projects, jobs, and invoices
              associated with this company. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={onDeleteCompany}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Company"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
