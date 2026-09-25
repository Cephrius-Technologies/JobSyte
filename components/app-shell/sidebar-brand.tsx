import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function SidebarBrand({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/dashboard"
      aria-label="JobSyte dashboard"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "size-10" : "h-16 w-full",
      )}
    >
      {compact ? (
        <Image src="/jobsyte-icon.png" alt="" width={240} height={240} className="size-10 rounded-lg" />
      ) : (
        <>
          <Image
            src="/jobsyte-wordmark-black-on-light.png"
            alt=""
            width={704}
            height={230}
            className="h-14 w-auto max-w-full object-contain dark:hidden"
          />
          <Image
            src="/jobsyte-wordmark-white-on-dark.png"
            alt=""
            width={704}
            height={230}
            className="hidden h-14 w-auto max-w-full object-contain dark:block"
          />
        </>
      )}
    </Link>
  );
}
