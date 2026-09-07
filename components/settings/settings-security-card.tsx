import { KeyRound, Mail, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SettingsSecurityCardProps = {
  newEmail: string;
  setNewEmail: (value: string) => void;
  savingEmail: boolean;
  onUpdateEmail: () => void;
  nextPassword: string;
  setNextPassword: (value: string) => void;
  confirmPassword: string;
  setConfirmPassword: (value: string) => void;
  savingPassword: boolean;
  onUpdatePassword: () => void;
};

export function SettingsSecurityCard({
  newEmail,
  setNewEmail,
  savingEmail,
  onUpdateEmail,
  nextPassword,
  setNextPassword,
  confirmPassword,
  setConfirmPassword,
  savingPassword,
  onUpdatePassword,
}: SettingsSecurityCardProps) {
  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Shield className="size-4 text-muted-foreground" />
        Security
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-3 rounded-md border border-border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <Mail className="size-4 text-muted-foreground" />
            Change Email
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">New Email Address</Label>
            <Input
              id="new-email"
              type="email"
              placeholder="new@email.com"
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={onUpdateEmail}
            disabled={savingEmail || !newEmail.trim()}
          >
            {savingEmail ? "Submitting..." : "Update Email"}
          </Button>
        </div>

        <div className="space-y-3 rounded-md border border-border p-4">
          <div className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4 text-muted-foreground" />
            Change Password
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">New Password</Label>
            <Input
              id="new-password"
              type="password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              placeholder="At least 8 characters"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirm Password</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter password"
            />
          </div>
          <Button
            type="button"
            onClick={onUpdatePassword}
            disabled={savingPassword || !nextPassword || !confirmPassword}
          >
            {savingPassword ? "Updating..." : "Update Password"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
