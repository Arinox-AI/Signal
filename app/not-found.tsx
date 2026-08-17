import Link from "next/link";
import { ArrowLeft, SearchX } from "lucide-react";

import { Brand } from "@/components/brand";
import { SearchBar } from "@/components/search-bar";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-5 text-center">
      <Brand />
      <span className="mt-14 grid size-14 place-items-center rounded-[20px] border border-white/[0.08] bg-white/[0.035]">
        <SearchX className="size-5 text-blue-200/60" />
      </span>
      <p className="mt-6 font-mono text-[10px] tracking-[0.18em] text-blue-200/45 uppercase">
        No verified match
      </p>
      <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em] text-white sm:text-5xl">
        That signal is too faint.
      </h1>
      <p className="mt-4 max-w-md text-sm leading-6 text-white/42">
        Try the company’s full name or paste its official domain. Ambiguous
        names are intentionally not guessed.
      </p>
      <div className="mt-8 w-full">
        <SearchBar />
      </div>
      <Link
        href="/"
        className="mt-4 inline-flex items-center gap-2 text-xs text-white/38 hover:text-white"
      >
        <ArrowLeft className="size-3.5" />
        Back home
      </Link>
    </main>
  );
}
