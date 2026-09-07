import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

type SettingsPreferencesCardProps = {
  emailInvoiceReminders: boolean;
  setEmailInvoiceReminders: (value: boolean) => void;
  weeklySummary: boolean;
  setWeeklySummary: (value: boolean) => void;
  productUpdates: boolean;
  setProductUpdates: (value: boolean) => void;
  defaultDueDays: string;
  setDefaultDueDays: (value: string) => void;
  savingPreferences: boolean;
  onSavePreferences: () => void;
};

export function SettingsPreferencesCard({
  emailInvoiceReminders,
  setEmailInvoiceReminders,
  weeklySummary,
  setWeeklySummary,
  productUpdates,
  setProductUpdates,
  defaultDueDays,
  setDefaultDueDays,
  savingPreferences,
  onSavePreferences,
}: SettingsPreferencesCardProps) {
  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Bell className="size-4 text-muted-foreground" />
        Preferences
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
          <div>
            <div className="font-medium">Invoice Reminder Emails</div>
            <div className="text-sm text-muted-foreground">
              Receive reminders for invoices nearing due date.
            </div>
          </div>
          <Switch
            checked={emailInvoiceReminders}
            onCheckedChange={setEmailInvoiceReminders}
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
          <div>
            <div className="font-medium">Weekly Summary</div>
            <div className="text-sm text-muted-foreground">
              Get a weekly email summary of job and invoice activity.
            </div>
          </div>
          <Switch checked={weeklySummary} onCheckedChange={setWeeklySummary} />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
          <div>
            <div className="font-medium">Product Updates</div>
            <div className="text-sm text-muted-foreground">
              Receive product release and improvement updates.
            </div>
          </div>
          <Switch checked={productUpdates} onCheckedChange={setProductUpdates} />
        </div>
      </div>

      <div className="max-w-xs space-y-2">
        <Label htmlFor="default-due-days">Default Invoice Due Days</Label>
        <Input
          id="default-due-days"
          type="number"
          min={0}
          max={180}
          value={defaultDueDays}
          onChange={(event) => setDefaultDueDays(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          Used as your preferred due-date offset when creating invoices.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onSavePreferences}
          disabled={savingPreferences}
        >
          {savingPreferences ? "Saving..." : "Save Preferences"}
        </Button>
      </div>
    </Card>
  );
}
