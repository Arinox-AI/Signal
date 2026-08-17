import { Building2, Languages, Users } from "lucide-react";
import Image from "next/image";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import { compactNumber } from "@/lib/format";
import type { CountryContext, SourceResult } from "@/lib/types/company";

export function CountryCard({
  result,
}: {
  result: SourceResult<CountryContext>;
}) {
  return (
    <Panel label="Operating context" className="dossier-country">
      {result.state !== "success" ? (
        <SourceUnavailable message={result.message} />
      ) : (
        <div className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-2xl font-medium tracking-[-0.035em] text-white">
                {result.data.name}
              </p>
              <p className="mt-1 text-xs text-white/35">
                {result.data.officialName}
              </p>
            </div>
            {result.data.flagUrl && (
              <Image
                src={result.data.flagUrl}
                alt={`${result.data.name} flag`}
                width={46}
                height={30}
                className="rounded object-cover"
                style={{ width: 46, height: 30 }}
              />
            )}
          </div>
          <dl className="mt-8 grid gap-5 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <div>
              <dt className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
                <Building2 className="size-3" />
                Capital
              </dt>
              <dd className="mt-2 text-sm text-white/70">
                {result.data.capital ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
                <Users className="size-3" />
                Population
              </dt>
              <dd className="mt-2 text-sm text-white/70">
                {compactNumber(result.data.population)}
              </dd>
            </div>
            <div>
              <dt className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
                <Languages className="size-3" />
                Languages
              </dt>
              <dd className="mt-2 truncate text-sm text-white/70">
                {result.data.languages.slice(0, 2).join(", ") || "—"}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Panel>
  );
}
