import { SiteHeader } from "@/components/site-header";

const Block = ({ className = "" }: { className?: string }) => (
  <div
    className={`shimmer rounded-[22px] border border-white/[0.07] bg-white/[0.035] ${className}`}
  />
);

export default function CompanyLoading() {
  return (
    <div
      className="min-h-screen"
      aria-label="Building company intelligence brief"
      aria-busy="true"
    >
      <SiteHeader />
      <div className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8 lg:px-12">
        <Block className="h-12 max-w-xl" />
        <div className="mt-14 flex items-center gap-5">
          <Block className="size-20 shrink-0" />
          <div className="w-full max-w-xl space-y-3">
            <Block className="h-10 w-3/5" />
            <Block className="h-4 w-full" />
          </div>
        </div>
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Block key={index} className="h-28" />
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-12">
          <Block className="h-80 lg:col-span-8" />
          <Block className="h-80 lg:col-span-4" />
          <Block className="h-96 lg:col-span-7" />
          <Block className="h-96 lg:col-span-5" />
          <Block className="h-80 lg:col-span-12" />
        </div>
      </div>
    </div>
  );
}
