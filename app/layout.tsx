import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { DocumentTitleSync } from "@/components/document-title-sync";
import { ThemeProvider } from "@/components/theme-provider";

// Onboarding: this is the root shell shared by marketing and app routes.
// Start with `docs/CODEMAPS/INDEX.md`, then compare the authenticated shell in
// `app/(jobsyte-app)/(app)/layout.tsx` and public routes in `app/(landing)/*`.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const siteUrl = new URL("https://app.jobsyte.co");
const defaultTitle = "JobSyte App";
const defaultDescription =
  "Access the JobSyte contractor dashboard for projects, schedules, invoices, payroll, accounting, and field operations.";

export const metadata: Metadata = {
  metadataBase: siteUrl,
  title: {
    default: defaultTitle,
    template: "%s | JobSyte",
  },
  applicationName: "JobSyte",
  authors: [{ name: "JobSyte", url: siteUrl.toString() }],
  creator: "JobSyte",
  publisher: "Cephrius Technologies",
  category: "Construction Project Management Software",
  keywords: [
    "construction project management",
    "construction project management software",
    "contractor project management software",
    "subcontractor software",
    "subcontractor project management",
    "builder job tracking",
    "construction scheduling software",
    "contractor invoice management",
    "contractor invoicing software",
    "construction workflow automation",
    "builder job site management",
    "home builder software",
    "builder change order tracking",
    "residential construction software",
    "field crew management software",
    "Jobsite",
    "Jobs",
    "CRM",
    "Job CRM",
    "Supply Pro",
    "Hypen Solutions",
    "Builder Support",
    
  ],
  description: defaultDescription,
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  robots: {
    index: false,
    follow: false,
    nocache: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "JobSyte",
    title: defaultTitle,
    description: defaultDescription,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "JobSyte app",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: defaultTitle,
    description: defaultDescription,
    images: ["/opengraph-image"],
  },
  icons: {
    icon: [
      { url: "/image.png", sizes: "any" },
    ],
    apple: "/jobsyte_safari.png",
    shortcut: "/jobstye_copy.ico",
  },
  // verification: { google: "<add-search-console-token>" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning={true}
    >
      <body className="antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <DocumentTitleSync />
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
