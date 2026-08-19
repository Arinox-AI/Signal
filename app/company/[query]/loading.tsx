import { SiteHeader } from "@/components/site-header";
import { ProgressStages } from "@/components/loading/progress-stages";

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
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0">
            <Block className="h-12 max-w-xl" />
            <Block className="mt-3 h-4 max-w-md" />
          </div>
          <ProgressStages />
        </div>
        <div className="mt-14 flex items-center gap-5">
          <Block className="size-20 shrink-0" />
          <div className="w-full max-w-xl space-y-3">
            <Block className="h-10 w-3/5" />
            <Block className="h-4 w-full" />
          </div>
        </div>
        <Block className="mt-8 h-12 max-w-md" />
        <div className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <Block key={index} className="h-28" />
          ))}
        </div>
        <div className="mt-5 grid gap-5 lg:grid-cols-12">
          <Block className="h-80 lg:col-span-8" />
          <Block className="h-80 lg:col-span-4" />
          <Block className="h-72 lg:col-span-12" />
          <Block className="h-72 lg:col-span-12" />
          <Block className="h-80 lg:col-span-7" />
          <Block className="h-80 lg:col-span-5" />
          <Block className="h-64 lg:col-span-5" />
          <Block className="h-96 lg:col-span-12" />
        </div>
      </div>
    </div>
  );
}
