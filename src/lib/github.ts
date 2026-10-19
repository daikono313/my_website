// ビルド時に GitHub API から活動データを取得する。
// GH_TOKEN / GITHUB_TOKEN があれば GraphQL でコントリビューションカレンダーも取得。
// 取得に失敗してもビルドは止めず、空データで描画する。

const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;

const headers: Record<string, string> = {
  Accept: "application/vnd.github+json",
  "User-Agent": "my-website-build",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

export type Repo = {
  name: string;
  url: string;
  description: string | null;
  language: string | null;
  stars: number;
  updatedAt: string;
};

export type ContributionDay = { date: string; count: number; level: number };

export type Activity = {
  type: string;
  repo: string;
  summary: string;
  url: string;
  createdAt: string;
};

// 外部 API 由来の URL は href に入れる前に https://github.com/ 配下か検証する
function safeUrl(url: unknown, fallback = "https://github.com/"): string {
  return typeof url === "string" && url.startsWith("https://github.com/") ? url : fallback;
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      console.warn(`[github] ${res.status} ${url}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[github] fetch failed ${url}`, e);
    return null;
  }
}

export async function getRepos(user: string): Promise<Repo[]> {
  const data = await getJson<any[]>(
    `https://api.github.com/users/${user}/repos?sort=pushed&per_page=100&type=owner`,
  );
  return (data ?? [])
    .filter((r) => !r.fork && !r.private)
    .map((r) => ({
      name: r.name,
      url: safeUrl(r.html_url),
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      updatedAt: r.pushed_at,
    }));
}

export async function getActivity(user: string, limit = 10): Promise<Activity[]> {
  const events = await getJson<any[]>(
    `https://api.github.com/users/${user}/events/public?per_page=50`,
  );
  const out: Activity[] = [];
  for (const e of events ?? []) {
    const repo = e.repo.name as string;
    const repoUrl = `https://github.com/${repo}`;
    let summary: string | null = null;
    let url = repoUrl;
    switch (e.type) {
      case "PushEvent": {
        const n = e.payload.size ?? e.payload.commits?.length ?? 0;
        const branch = String(e.payload.ref ?? "").replace("refs/heads/", "");
        summary = n > 0 ? `${n} commit${n > 1 ? "s" : ""} を ${branch} に push` : `${branch} に push`;
        url = e.payload.head ? `${repoUrl}/commit/${e.payload.head}` : url;
        break;
      }
      case "PullRequestEvent":
        // Events API の payload は PR タイトルを含まないため番号で表示
        summary = `PR #${e.payload.number} を ${e.payload.action}`;
        url = `${repoUrl}/pull/${e.payload.number}`;
        break;
      case "IssuesEvent":
        summary = `Issue #${e.payload.issue?.number} を ${e.payload.action}: ${e.payload.issue?.title ?? ""}`;
        url = e.payload.issue?.html_url ?? url;
        break;
      case "CreateEvent":
        summary = e.payload.ref_type === "repository" ? "リポジトリを作成" : `${e.payload.ref_type} ${e.payload.ref} を作成`;
        break;
      case "ReleaseEvent":
        summary = `Release ${e.payload.release?.tag_name ?? ""}`;
        url = e.payload.release?.html_url ?? url;
        break;
      case "WatchEvent":
        summary = "Star";
        break;
    }
    if (summary) out.push({ type: e.type, repo, summary, url: safeUrl(url, repoUrl), createdAt: e.created_at });
    if (out.length >= limit) break;
  }
  return out;
}

export async function getContributions(
  user: string,
): Promise<{ total: number; weeks: ContributionDay[][] } | null> {
  if (!token) return null;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `query($login: String!) {
          user(login: $login) {
            contributionsCollection {
              contributionCalendar {
                totalContributions
                weeks { contributionDays { date contributionCount contributionLevel } }
              }
            }
          }
        }`,
        variables: { login: user },
      }),
    });
    const json: any = await res.json();
    const cal = json?.data?.user?.contributionsCollection?.contributionCalendar;
    if (!cal) return null;
    const levels: Record<string, number> = {
      NONE: 0,
      FIRST_QUARTILE: 1,
      SECOND_QUARTILE: 2,
      THIRD_QUARTILE: 3,
      FOURTH_QUARTILE: 4,
    };
    return {
      total: cal.totalContributions,
      weeks: cal.weeks.map((w: any) =>
        w.contributionDays.map((d: any) => ({
          date: d.date,
          count: d.contributionCount,
          level: levels[d.contributionLevel] ?? 0,
        })),
      ),
    };
  } catch (e) {
    console.warn("[github] contributions failed", e);
    return null;
  }
}
