import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type SettingsBusinessProfileCardProps = {
  companyName: string;
  setCompanyName: (value: string) => void;
  phone: string;
  setPhone: (value: string) => void;
  address: string;
  setAddress: (value: string) => void;
  savingProfile: boolean;
  onSaveProfile: () => void;
};

export function SettingsBusinessProfileCard({
  companyName,
  setCompanyName,
  phone,
  setPhone,
  address,
  setAddress,
  savingProfile,
  onSaveProfile,
}: SettingsBusinessProfileCardProps) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Building2 className="size-4 text-muted-foreground" />
        Business Profile
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company-name">Company Name</Label>
          <Input
            id="company-name"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Cephrius LLC"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company-phone">Phone</Label>
          <Input
            id="company-phone"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(555) 555-0100"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="company-address">Business Address</Label>
        <Textarea
          id="company-address"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          rows={3}
          placeholder="Street, City, State ZIP"
        />
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={onSaveProfile}
          disabled={savingProfile || !companyName.trim()}
        >
          {savingProfile ? "Saving..." : "Save Profile"}
        </Button>
      </div>
    </Card>
  );
}
