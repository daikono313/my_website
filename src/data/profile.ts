// サイトに表示する自己紹介データ。ここを編集すればページに反映されます。
// TODO の箇所はご自身の情報に置き換えてください。

export const profile = {
  name: "Daisuke Harato",
  nameJa: "", // TODO: 漢字表記（空なら非表示）
  title: "Data Engineer", // TODO
  githubUser: "daikono313",
  summary:
    "データ基盤の設計・構築・運用を専門とするエンジニア。最近は AI エージェントによるデータ基盤の自律構築・運用に取り組んでいます。", // TODO
  links: [
    { label: "GitHub", href: "https://github.com/daikono313" },
    { label: "LinkedIn", href: "https://www.linkedin.com/in/harato-daisuke-3543411a6/" },
    // { label: "X", href: "https://x.com/..." },
    // { label: "Zenn", href: "https://zenn.dev/..." },
  ],
};

export const skills: { category: string; items: string[] }[] = [
  // TODO: 実際のスキルに置き換え
  { category: "Languages", items: ["Python", "SQL", "TypeScript"] },
  { category: "Data", items: ["Snowflake", "dbt", "BigQuery", "Airflow"] },
  { category: "Cloud / Infra", items: ["AWS", "GCP", "Terraform", "Docker"] },
  { category: "AI", items: ["LLM Agents", "Claude"] },
];

// GitHub の pinned 相当として強調表示するリポジトリ名（空なら最近更新順に自動表示）
export const featuredRepos: string[] = ["agentic-data-platform"];
