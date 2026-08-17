import { ArrowUpRight, GitFork, Star } from "lucide-react";

import { Panel, SourceUnavailable } from "@/components/report/panel";
import { compactNumber, relativeDate } from "@/lib/format";
import type { GithubActivity, SourceResult } from "@/lib/types/company";

export function GithubCard({
  result,
}: {
  result: SourceResult<GithubActivity>;
}) {
  return (
    <Panel label="Builder velocity" className="dossier-github flex flex-col">
      {result.state !== "success" ? (
        <SourceUnavailable message={result.message} />
      ) : (
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium text-white">
                @{result.data.organization}
              </p>
              <p className="mt-1 text-xs text-white/35">
                {compactNumber(result.data.followers)} followers
              </p>
            </div>
            <a
              href={result.data.url}
              target="_blank"
              rel="noreferrer"
              aria-label="Open GitHub organization"
              className="grid size-9 place-items-center rounded-full border border-white/[0.08] text-white/40 hover:text-white"
            >
              <ArrowUpRight className="size-4" />
            </a>
          </div>
          <div className="mt-6 space-y-2">
            {result.data.topRepositories.slice(0, 3).map((repo) => (
              <a
                key={repo.name}
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-2xl border border-white/[0.06] bg-black/15 p-4 transition hover:border-white/[0.12] hover:bg-white/[0.025]"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-medium text-white/75">
                    {repo.name}
                  </p>
                  <span className="shrink-0 text-[10px] text-white/28">
                    {relativeDate(repo.updatedAt)}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/35">
                  {repo.description || "Public repository"}
                </p>
                <div className="mt-3 flex gap-3 text-[10px] text-white/30">
                  {repo.language && <span>{repo.language}</span>}
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3" />
                    {compactNumber(repo.stars)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="size-3" />
                    Active
                  </span>
                </div>
              </a>
            ))}
          </div>
          <dl className="mt-auto grid grid-cols-2 gap-2 border-t border-white/[0.06] pt-5">
            <div className="rounded-xl bg-white/[0.025] px-3 py-2.5">
              <dt className="font-mono text-[9px] tracking-wider text-white/25 uppercase">
                Public repos
              </dt>
              <dd className="mt-1 text-sm font-medium text-white/65">
                {compactNumber(result.data.publicRepos)}
              </dd>
            </div>
            <div className="rounded-xl bg-white/[0.025] px-3 py-2.5">
              <dt className="font-mono text-[9px] tracking-wider text-white/25 uppercase">
                Repo stars
              </dt>
              <dd className="mt-1 text-sm font-medium text-white/65">
                {compactNumber(result.data.stars)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Panel>
  );
}
