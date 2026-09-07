"use client"; 

// Onboarding: settings hub composed from smaller cards in `components/settings/*`.
// Writes go through `app/(jobsyte-app)/(app)/settings/actions.ts` and
// `company-actions.ts`; preference parsing lives in `lib/settings/preferences.ts`.
import { useMemo, useState } from "react"; 
import { useRouter } from "next/navigation";
import { toast } from "sonner";   
import { createClient } from "@/lib/supabase/client";  
import {
  updateAccountEmail,
  updateAccountPassword,
  updateCompanyProfile,   
  updatePreferences,
} from "@/app/(jobsyte-app)/settings/actions";
import { SettingsAccountDetailsCard } from "@/components/settings/settings-account-details-card";
import { SettingsAppearanceCard } from "@/components/settings/settings-appearance-card"; 
import { SettingsBusinessProfileCard } from "@/components/settings/settings-business-profile-card";
import { SettingsPreferencesCard } from "@/components/settings/settings-preferences-card";
import { SettingsSecurityCard } from "@/components/settings/settings-security-card";
import { SettingsDataSessionCard } from "@/components/settings/settings-data-session-card";
import { SettingsReleaseNotesCard } from "@/components/settings/settings-release-notes-card";
import { SettingsProjectPresetsCard } from "@/components/settings/settings-project-presets-card";
import type { ProjectPresetForSettings } from "@/app/(jobsyte-app)/settings/actions";

type SettingsPageClientProps = {
  initialProfile: {
    companyId: string;
    companyName: string;
    address: string;
    phone: string;
  };
  account: {     
    email: string;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
  initialPreferences: {   
    emailInvoiceReminders: boolean;
    weeklySummary: boolean;
    productUpdates: boolean;
    defaultDueDays: number;
  };
  initialProjectPresets: ProjectPresetForSettings[];
};

const PROJECT_STORAGE_KEYS_TO_CLEAR_ON_SIGN_OUT = [   
  "projects:selected-project-id",
  "projects:expanded-subdivisions",
  "projects:expanded-builders",
];

function clampDueDays(value: number) {  
  if (!Number.isFinite(value)) return 30;
  return Math.min(180, Math.max(0, Math.round(value)));
}

export function SettingsPageClient({  
  initialProfile,
  account,
  initialPreferences,
  initialProjectPresets,
}: SettingsPageClientProps) {
  const router = useRouter();  
  const supabase = useMemo(() => createClient(), []);  

  const [companyName, setCompanyName] = useState(initialProfile.companyName);
  const [address, setAddress] = useState(initialProfile.address);
  const [phone, setPhone] = useState(initialProfile.phone);
  const [savingProfile, setSavingProfile] = useState(false);

  const [emailInvoiceReminders, setEmailInvoiceReminders] = useState(
    initialPreferences.emailInvoiceReminders,
  );
  const [weeklySummary, setWeeklySummary] = useState(                 
    initialPreferences.weeklySummary,
  );
  const [productUpdates, setProductUpdates] = useState(
    initialPreferences.productUpdates,
  );
  const [defaultDueDays, setDefaultDueDays] = useState(
    String(initialPreferences.defaultDueDays),
  );
  const [savingPreferences, setSavingPreferences] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [signingOutAll, setSigningOutAll] = useState(false);



  async function onSaveProfile() {    
    setSavingProfile(true);
    const res = await updateCompanyProfile({
      companyId: initialProfile.companyId,
      companyName,
      address,
      phone,
    });
    setSavingProfile(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }

    toast.success(res.message ?? "Profile updated.");
    router.refresh();
  }

  async function onSavePreferences() { 
    setSavingPreferences(true);

    const parsed = Number(defaultDueDays);
    const dueDays = clampDueDays(parsed);
    const res = await updatePreferences({
      emailInvoiceReminders,
      weeklySummary,
      productUpdates,
      defaultDueDays: dueDays,
    });

    setSavingPreferences(false);
    if (!res.ok) {
      toast.error(res.message);
      return;
    }

    setDefaultDueDays(String(dueDays));
    toast.success(res.message ?? "Preferences saved.");
    router.refresh();
  }

  async function onUpdateEmail() {  
    setSavingEmail(true);
    const res = await updateAccountEmail({ email: newEmail });
    setSavingEmail(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }

    toast.success(res.message ?? "Email update requested.");
    setNewEmail("");
  }

  async function onUpdatePassword() { 
    setSavingPassword(true);
    const res = await updateAccountPassword({
      nextPassword,
      confirmPassword,
    });
    setSavingPassword(false);

    if (!res.ok) {
      toast.error(res.message);
      return;
    }

    setNextPassword("");
    setConfirmPassword("");
    toast.success(res.message ?? "Password updated.");
  }

  async function onSignOutEverywhere() { 
    setSigningOutAll(true);

    for (const key of PROJECT_STORAGE_KEYS_TO_CLEAR_ON_SIGN_OUT) {
      window.localStorage.removeItem(key);
      window.sessionStorage.removeItem(key);
    }

    const { error } = await supabase.auth.signOut({ scope: "global" });
    setSigningOutAll(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    window.location.href = "/login";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account, business profile, preferences, and security.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsAccountDetailsCard account={account} />

        <SettingsAppearanceCard />
      </div>

      <div className="lg:hidden">
        <SettingsReleaseNotesCard />
      </div>

      <SettingsBusinessProfileCard
        companyName={companyName}
        setCompanyName={setCompanyName}
        phone={phone}
        setPhone={setPhone}
        address={address}
        setAddress={setAddress}
        savingProfile={savingProfile}
        onSaveProfile={onSaveProfile}
      />

      <SettingsPreferencesCard
        emailInvoiceReminders={emailInvoiceReminders}
        setEmailInvoiceReminders={setEmailInvoiceReminders}
        weeklySummary={weeklySummary}
        setWeeklySummary={setWeeklySummary}
        productUpdates={productUpdates}
        setProductUpdates={setProductUpdates}
        defaultDueDays={defaultDueDays}
        setDefaultDueDays={setDefaultDueDays}
        savingPreferences={savingPreferences}
        onSavePreferences={onSavePreferences}
      />

      <SettingsProjectPresetsCard initialPresets={initialProjectPresets} />

      <SettingsSecurityCard
        newEmail={newEmail}
        setNewEmail={setNewEmail}
        savingEmail={savingEmail}
        onUpdateEmail={onUpdateEmail}
        nextPassword={nextPassword}
        setNextPassword={setNextPassword}
        confirmPassword={confirmPassword}
        setConfirmPassword={setConfirmPassword}
        savingPassword={savingPassword}
        onUpdatePassword={onUpdatePassword}
      />

      <SettingsDataSessionCard
        signingOutAll={signingOutAll}
        onSignOutEverywhere={onSignOutEverywhere}
      />
    </div>
  );
}
