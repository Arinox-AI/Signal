import "server-only";

import { z } from "zod";

import { resilientFetch, UpstreamError } from "@/lib/http/request";
import type { GithubActivity } from "@/lib/types/company";

export class GithubNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GithubNotFoundError";
  }
}

const orgSchema = z.object({
  login: z.string(),
  html_url: z.string().url(),
  avatar_url: z.string().url(),
  followers: z.number(),
  public_repos: z.number(),
  updated_at: z.string(),
});
const repoSchema = z.object({
  name: z.string(),
  html_url: z.string().url(),
  description: z.string().nullable(),
  stargazers_count: z.number(),
  forks_count: z.number(),
  open_issues_count: z.number(),
  language: z.string().nullable(),
  updated_at: z.string(),
});

function headers(): HeadersInit {
  return process.env.GITHUB_TOKEN
    ? {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "X-GitHub-Api-Version": "2022-11-28",
      }
    : { "X-GitHub-Api-Version": "2022-11-28" };
}

export async function getGithubActivity(
  companyName: string,
): Promise<GithubActivity> {
  const words = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/);
  const legalSuffixes = new Set([
    "co",
    "company",
    "corp",
    "corporation",
    "group",
    "inc",
    "incorporated",
    "limited",
    "llc",
    "ltd",
    "plc",
  ]);
  const meaningfulWords = words.filter((word) => !legalSuffixes.has(word));
  const candidates = [
    meaningfulWords.join(""),
    words.join(""),
    meaningfulWords[0] ?? "",
  ].filter(
    (candidate, index, list) => candidate && list.indexOf(candidate) === index,
  );

  let org: z.infer<typeof orgSchema> | null = null;
  for (const candidate of candidates) {
    try {
      const orgResponse = await resilientFetch(
        `https://api.github.com/orgs/${encodeURIComponent(candidate)}`,
        { headers: headers() },
        { revalidate: 1_800, retries: 0 },
      );
      org = orgSchema.parse(await orgResponse.json());
      break;
    } catch (error) {
      if (!(error instanceof UpstreamError) || error.status !== 404)
        throw error;
    }
  }
  if (!org)
    throw new GithubNotFoundError("No verified GitHub organization was found.");
  if (org.public_repos === 0)
    throw new GithubNotFoundError("No public GitHub activity was available.");
  const reposResponse = await resilientFetch(
    `https://api.github.com/orgs/${encodeURIComponent(org.login)}/repos?type=public&sort=updated&per_page=30`,
    { headers: headers() },
    { revalidate: 900 },
  );
  const repos = z.array(repoSchema).parse(await reposResponse.json());
  const topRepositories = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 4);
  return {
    organization: org.login,
    url: org.html_url,
    avatarUrl: org.avatar_url,
    followers: org.followers,
    publicRepos: org.public_repos,
    stars: repos.reduce((sum, repo) => sum + repo.stargazers_count, 0),
    forks: repos.reduce((sum, repo) => sum + repo.forks_count, 0),
    openIssues: repos.reduce((sum, repo) => sum + repo.open_issues_count, 0),
    updatedAt: org.updated_at,
    topRepositories: topRepositories.map((repo) => ({
      name: repo.name,
      url: repo.html_url,
      description: repo.description,
      stars: repo.stargazers_count,
      language: repo.language,
      updatedAt: repo.updated_at,
    })),
  };
}
