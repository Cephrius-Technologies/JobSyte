import { Divide } from "lucide-react";
import type { Metadata } from "next";

// Keep account flows out of search results.
export const metadata: Metadata = {
  title: "Account | JobSyte",
  description: "Secure account access for JobSyte customers.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="auth-workspace">
      <aside className="auth-intro">
        <div className="text-xl font-semibold tracking-tight">
          JobSyte<span className="text-orange-400">.</span>
        </div>
        <div className="space-y-6">
          <h1>Great work starts here</h1>
          <p>
            From the first job to the final invoice. One organized workspace for your projects, your poeople and everything in between.
          </p>
        </div>
        <p className="text-sm">Built for the way your team works.</p>
      </aside>
      <div className="auth-content">{children}</div>
    </div>
  );
}