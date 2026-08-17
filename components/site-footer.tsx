import { Brand } from "@/components/brand";

export function SiteFooter() {
  return (
    <footer className="site-footer mx-auto mt-auto flex w-full max-w-[1440px] flex-col gap-5 px-5 py-8 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12">
      <Brand className="opacity-70" />
      <p>Public intelligence, synthesized with source-aware AI.</p>
      <p>GLEIF · Wikidata · Public web · RSS · Countries · Gemini</p>
    </footer>
  );
}
