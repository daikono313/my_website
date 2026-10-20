// ビルド時に GitHub API から活動データを取得する。
// GH_TOKEN / GITHUB_TOKEN があれば GraphQL でコントリビューションと月平均の統計も取得する。
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

export type Stats = {
  total: number;
  weeks: ContributionDay[][];
  months: number; // 集計期間（月）
  commitsPerMonth: number;
  mergedPrsPerMonth: number;
};

const DAY = 24 * 60 * 60 * 1000;

// 直近1年（アカウント作成が1年以内なら作成日から）のコミット数・マージ済み PR 数を月平均にする
export async function getStats(user: string): Promise<Stats | null> {
  if (!token) return null;
  try {
    const gql = async (query: string, variables: Record<string, unknown>) => {
      const res = await fetch("https://api.github.com/graphql", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      return (await res.json()) as any;
    };

    const now = new Date();
    const created = await gql(`query($login: String!) { user(login: $login) { createdAt } }`, { login: user });
    const createdAt = new Date(created?.data?.user?.createdAt ?? 0);
    const from = new Date(Math.max(createdAt.getTime(), now.getTime() - 365 * DAY));
    const months = Math.max(1, (now.getTime() - from.getTime()) / (30.44 * DAY));
    const since = from.toISOString().slice(0, 10);

    const json = await gql(
      `query($login: String!, $from: DateTime!, $to: DateTime!, $q: String!) {
        user(login: $login) {
          contributionsCollection(from: $from, to: $to) {
            totalCommitContributions
            contributionCalendar {
              totalContributions
              weeks { contributionDays { date contributionCount contributionLevel } }
            }
          }
        }
        merged: search(query: $q, type: ISSUE, first: 1) { issueCount }
      }`,
      {
        login: user,
        from: new Date(now.getTime() - 365 * DAY).toISOString(),
        to: now.toISOString(),
        q: `author:${user} is:pr is:merged merged:>=${since}`,
      },
    );
    const cc = json?.data?.user?.contributionsCollection;
    if (!cc) return null;
    const levels: Record<string, number> = {
      NONE: 0,
      FIRST_QUARTILE: 1,
      SECOND_QUARTILE: 2,
      THIRD_QUARTILE: 3,
      FOURTH_QUARTILE: 4,
    };
    return {
      total: cc.contributionCalendar.totalContributions,
      weeks: cc.contributionCalendar.weeks.map((w: any) =>
        w.contributionDays.map((d: any) => ({
          date: d.date,
          count: d.contributionCount,
          level: levels[d.contributionLevel] ?? 0,
        })),
      ),
      months,
      commitsPerMonth: cc.totalCommitContributions / months,
      mergedPrsPerMonth: (json?.data?.merged?.issueCount ?? 0) / months,
    };
  } catch (e) {
    console.warn("[github] stats failed", e);
    return null;
  }
}
