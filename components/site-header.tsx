import { Code2 } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/brand";

export function SiteHeader() {
  const sourceUrl = process.env.NEXT_PUBLIC_SOURCE_URL;

  return (
    <header className="site-header sticky top-0 z-50">
      <div className="mx-auto flex w-full max-w-[1440px] items-center justify-between px-5 py-4 sm:px-8 lg:px-12">
        <Brand />
        <nav
          aria-label="Primary navigation"
          className="hidden items-center gap-7 md:flex"
        >
          <Link href="/#product" className="site-nav-link">
            Product
          </Link>
          <Link href="/#how-it-works" className="site-nav-link">
            How it works
          </Link>
          <Link href="/#sources" className="site-nav-link">
            Sources
          </Link>
        </nav>
        <div className="flex items-center gap-2">
          <span className="site-status hidden items-center gap-2 sm:flex">
            <span className="size-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
            Public data, live
          </span>
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="site-icon-button"
              aria-label="View source repository"
            >
              <Code2 className="size-4" aria-hidden="true" />
            </a>
          ) : null}
          <Link href="/#get-signal" className="site-cta">
            Get Signal
          </Link>
        </div>
      </div>
    </header>
  );
}
