import {
  Boxes,
  Factory,
  ShoppingBag,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import type {
  BusinessDeepDive,
  CompanyIdentity,
  SourceResult,
} from "@/lib/types/company";

function Block({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/[0.06] pt-4 first:border-t-0 first:pt-0">
      <p className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
        <Icon className="size-3" aria-hidden="true" />
        {label}
      </p>
      <p className="text-sm leading-6 text-white/60">{value}</p>
    </div>
  );
}

export function BusinessPanel({
  result,
  identity,
}: {
  result: SourceResult<BusinessDeepDive>;
  identity: CompanyIdentity;
}) {
  return (
    <Panel label="Business & operations" className="dossier-business">
      {result.state !== "success" ? (
        <SourceUnavailable message={result.message} />
      ) : (
        <div className="space-y-4 p-5 sm:p-6">
          <Block icon={Boxes} label="What it does" value={result.data.what} />
          <Block
            icon={Factory}
            label="How it operates"
            value={result.data.process}
          />
          <Block
            icon={ShoppingBag}
            label="Who it serves"
            value={result.data.customers}
          />
          <Block
            icon={TriangleAlert}
            label="What remains unknown"
            value={result.data.unknown}
          />
          <p className="flex items-center gap-1.5 text-[10px] leading-4 text-white/25">
            <Sparkles className="size-3" aria-hidden="true" />
            {result.data.generated
              ? "Synthesized by Gemini from the linked sources — never invents facts not present in the evidence."
              : "Assembled from the public record and website metadata; not AI-synthesized."}
          </p>
          {identity.overview && (
            <details className="group rounded-xl border border-white/[0.06]">
              <summary className="cursor-pointer px-4 py-3 text-xs text-white/45 transition hover:text-white/75">
                Full public profile · {identity.name}
              </summary>
              <p className="px-4 pb-4 text-xs leading-5 text-white/40">
                {identity.overview}
              </p>
            </details>
          )}
        </div>
      )}
    </Panel>
  );
}
