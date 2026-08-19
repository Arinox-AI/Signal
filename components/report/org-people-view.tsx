"use client";

import {
  AtSign,
  Briefcase,
  ExternalLink,
  Radar,
  Scale,
  TrendingUp,
  Users,
} from "lucide-react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import { cn } from "@/lib/utils";
import type { OrgPeopleData, SourceResult } from "@/lib/types/company";

const MIN_CONFIDENCE = 0.35;

function dateLabel(value: string): string {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleDateString("en", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";
}

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function SourceLine({ url, label }: { url: string | null; label: string }) {
  if (!url) return null;
  return (
    <p className="mt-4 flex items-center gap-1 text-[10px] text-white/25">
      Source:
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-0.5 text-blue-100/55 transition-colors hover:text-blue-100"
      >
        {label}
        <ExternalLink className="size-2.5" aria-hidden="true" />
      </a>
    </p>
  );
}

function PersonLinks({
  wikipediaUrl,
  linkedinUrl,
  name,
}: {
  wikipediaUrl: string | null;
  linkedinUrl: string | null;
  name: string;
}) {
  return (
    <span className="flex items-center gap-2">
      {wikipediaUrl && (
        <a
          href={wikipediaUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${name} on Wikipedia`}
          className="text-white/25 transition-colors hover:text-white/70"
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
      )}
      {linkedinUrl && (
        <a
          href={linkedinUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`${name} on LinkedIn`}
          className="text-white/25 transition-colors hover:text-white/70"
        >
          <AtSign className="size-3.5" aria-hidden="true" />
        </a>
      )}
    </span>
  );
}

function PersonRow({ person }: { person: OrgPeopleData["people"][number] }) {
  return (
    <li className="flex items-center justify-between gap-2 py-2 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-white/80">{person.name}</p>
        {person.role && (
          <p className="mt-0.5 text-[11px] text-white/35">{person.role}</p>
        )}
      </div>
      <PersonLinks
        wikipediaUrl={person.wikipediaUrl}
        linkedinUrl={person.linkedinUrl}
        name={person.name}
      />
    </li>
  );
}

function EmptyBlock() {
  return <p className="py-2 text-sm text-white/25">—</p>;
}

export function OrgPeopleView({
  result,
}: {
  result: SourceResult<OrgPeopleData>;
}) {
  if (result.state !== "success") {
    return (
      <Panel label="Org & people" className="dossier-org-people">
        <SourceUnavailable message={result.message} />
      </Panel>
    );
  }

  const {
    people,
    activity,
    ownership,
    headcount,
    hiring,
    aiNews,
    confidence,
    signal,
  } = result.data;
  if (confidence < MIN_CONFIDENCE) return null;

  const founders = people.filter((person) => person.tier === "founder");
  const executives = people.filter((person) => person.tier === "executive");
  const board = people.filter((person) => person.tier === "board");
  const maxSample = headcount.samples.length
    ? Math.max(...headcount.samples.map((sample) => sample.total))
    : 0;
  const leadershipSource =
    people.find((person) => person.sourceUrl)?.sourceUrl ?? null;

  return (
    <Panel label="Org & people" className="dossier-org-people">
      <div className="grid gap-x-8 gap-y-10 p-6 sm:grid-cols-2 xl:grid-cols-3">
        <div>
          <p className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
            <Users className="size-3" aria-hidden="true" />
            Leadership & board
          </p>
          <div className="mt-4">
            {founders.length || executives.length || board.length ? (
              <>
                {founders.length > 0 && (
                  <>
                    <p className="text-[10px] tracking-wider text-white/20 uppercase">
                      Founders
                    </p>
                    <ul className="mt-1 border-b border-white/[0.06] pb-3">
                      {founders.map((person) => (
                        <PersonRow key={person.name} person={person} />
                      ))}
                    </ul>
                  </>
                )}
                {executives.length > 0 && (
                  <>
                    <p className="mt-3 text-[10px] tracking-wider text-white/20 uppercase">
                      C-suite
                    </p>
                    <ul className="mt-1 border-b border-white/[0.06] pb-3">
                      {executives.map((person) => (
                        <PersonRow key={person.name} person={person} />
                      ))}
                    </ul>
                  </>
                )}
                {board.length > 0 && (
                  <>
                    <p className="mt-3 text-[10px] tracking-wider text-white/20 uppercase">
                      Board
                    </p>
                    <ul className="mt-1">
                      {board.map((person) => (
                        <PersonRow key={person.name} person={person} />
                      ))}
                    </ul>
                  </>
                )}
              </>
            ) : (
              <EmptyBlock />
            )}
          </div>
          <SourceLine
            url={leadershipSource}
            label={`${sourceHost(leadershipSource ?? "")}`}
          />
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
            <Radar className="size-3" aria-hidden="true" />
            Activity radar
          </p>
          <div className="mt-4">
            {activity.length ? (
              <ul className="space-y-4">
                {activity.map((entry) => (
                  <li key={entry.name}>
                    <p className="text-sm text-white/80">
                      {entry.name}
                      {entry.role && (
                        <span className="text-white/35"> · {entry.role}</span>
                      )}
                    </p>
                    <ul className="mt-1.5 space-y-1">
                      {entry.headlines.map((headline) => (
                        <li key={headline.id}>
                          <a
                            href={headline.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs leading-5 text-white/55 transition-colors hover:text-white/85"
                          >
                            {headline.title}
                          </a>
                          <p className="mt-0.5 text-[10px] text-white/25">
                            {headline.source} ·{" "}
                            {dateLabel(headline.publishedAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyBlock />
            )}
          </div>
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
            <Scale className="size-3" aria-hidden="true" />
            Stakeholders
          </p>
          <dl className="mt-4 space-y-4">
            <div>
              <dt className="text-[11px] text-white/35">Promoter stake</dt>
              <dd className="mt-1 text-xl font-medium tracking-[-0.02em] text-white">
                {ownership.promoterPct !== null
                  ? `${ownership.promoterPct}%`
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/35">Public holding</dt>
              <dd className="mt-1 text-xl font-medium tracking-[-0.02em] text-white">
                {ownership.publicPct !== null ? `${ownership.publicPct}%` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/35">Board size</dt>
              <dd className="mt-1 text-xl font-medium tracking-[-0.02em] text-white">
                {board.length || "—"}
              </dd>
            </div>
          </dl>
          <SourceLine url={ownership.sourceUrl} label="Shareholding pattern" />
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
            <TrendingUp className="size-3" aria-hidden="true" />
            Headcount
          </p>
          <dl className="mt-4">
            <div>
              <dd className="text-2xl font-medium tracking-[-0.03em] text-white">
                {headcount.total !== null
                  ? `~${headcount.total.toLocaleString("en")}`
                  : "—"}
              </dd>
              <dt className="mt-1 text-[11px] text-white/35">
                {headcount.total !== null
                  ? headcount.year
                    ? `Employees (${headcount.year} sample)`
                    : "Employees (undated sample)"
                  : "No public headcount found"}
              </dt>
            </div>
            {headcount.samples.length >= 2 && (
              <div className="mt-4">
                <div className="flex h-20 items-end gap-2">
                  {headcount.samples.map((sample) => (
                    <div
                      key={sample.year ?? sample.total}
                      className="flex h-full flex-1 flex-col justify-end gap-1"
                    >
                      <div
                        className={cn(
                          "w-full rounded-sm",
                          sample.year === headcount.year
                            ? "bg-emerald-300/70"
                            : "bg-emerald-300/25",
                        )}
                        style={{
                          height: `${Math.max(
                            6,
                            Math.round((sample.total / maxSample) * 100),
                          )}%`,
                        }}
                        title={`${sample.year ?? "?"}: ${sample.total.toLocaleString("en")}`}
                      />
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-2 text-[10px] text-white/25">
                  {headcount.samples.map((sample) => (
                    <span
                      key={sample.year ?? sample.total}
                      className="flex-1 text-center"
                    >
                      {sample.year ?? "?"}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-5 text-[11px] leading-5 text-white/28">
              Dated samples come from Wikidata; department-level splits are
              rarely published.
            </p>
          </dl>
          <SourceLine
            url={headcount.sourceUrl}
            label="Wikidata entity record"
          />
        </div>

        <div>
          <p className="flex items-center gap-1.5 text-[10px] tracking-wider text-white/28 uppercase">
            <Briefcase className="size-3" aria-hidden="true" />
            Hiring & AI
          </p>
          {hiring.roles.length ? (
            <>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {hiring.roles.slice(0, 8).map((role) => (
                  <li
                    key={role.title}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] leading-4",
                      role.ai
                        ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200/90"
                        : "border-white/10 text-white/50",
                    )}
                  >
                    {role.title}
                  </li>
                ))}
              </ul>
              {aiNews.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {aiNews.slice(0, 2).map((headline) => (
                    <li key={headline.id}>
                      <a
                        href={headline.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs leading-5 text-white/55 transition-colors hover:text-white/85"
                      >
                        {headline.title}
                      </a>
                      <p className="mt-0.5 text-[10px] text-white/25">
                        {headline.source} · {dateLabel(headline.publishedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <p className="mt-4 text-sm text-white/25">
                No open roles found on the static careers page.
              </p>
              <p className="mt-2 text-[11px] leading-5 text-white/28">
                Dynamic job boards (Greenhouse, Workday, ...) do not surface in
                raw HTML; AI news below still reflects the direction of the
                company.
              </p>
              {aiNews.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {aiNews.slice(0, 2).map((headline) => (
                    <li key={headline.id}>
                      <a
                        href={headline.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs leading-5 text-white/55 transition-colors hover:text-white/85"
                      >
                        {headline.title}
                      </a>
                      <p className="mt-0.5 text-[10px] text-white/25">
                        {headline.source} · {dateLabel(headline.publishedAt)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <SourceLine url={hiring.sourceUrl} label="Careers page" />
        </div>
      </div>

      <div className="flex items-start gap-3 border-t border-white/[0.06] bg-white/[0.02] px-6 py-4">
        <Radar
          className="mt-0.5 size-4 shrink-0 text-emerald-300/70"
          aria-hidden="true"
        />
        <p className="text-sm leading-6 text-white/60">{signal}</p>
      </div>
    </Panel>
  );
}
