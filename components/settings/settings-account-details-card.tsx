import { Info } from "lucide-react";  
import { Card } from "@/components/ui/card";  

type SettingsAccountDetailsCardProps = {
  account: {  
    email: string;
    createdAt: string | null;
    lastSignInAt: string | null;
  };
};


function formatDate(value: string | null) {  
  if (!value) return "N/A";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "N/A";

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function SettingsAccountDetailsCard({
  account,
}: SettingsAccountDetailsCardProps) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-center gap-2 text-lg font-semibold">
        <Info className="size-4 text-muted-foreground" />
        Account Details
      </div>

      <div className="space-y-2 text-sm">
        <div>
          <div className="font-medium text-muted-foreground">Current Email</div>
          <div className="text-muted-foreground">{account.email}</div>
        </div>
        <div>
          <div className="font-medium text-muted-foreground">Account Created</div>
          <div className="text-muted-foreground">
            {formatDate(account.createdAt)}
          </div>
        </div>
        <div>
          <div className="font-medium text-muted-foreground">Last Sign In</div>
          <div className="text-muted-foreground">
            {formatDate(account.lastSignInAt)}
          </div>
        </div>
      </div>
    </Card>
  );
}
