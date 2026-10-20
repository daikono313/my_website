// Weekly Tech Report の情報源（自動収集・Claude による手動作成の両方で使う唯一のリスト）
// category: platform（製品リリースノート）/ oss / ai / blog

export const SOURCES = [
  // 1. データ基盤製品（公式リリースノート）
  { name: "Snowflake", category: "platform", type: "snowflake-notes", url: "https://docs.snowflake.com/en/release-notes/new-features" },
  { name: "Databricks", category: "platform", type: "feed", url: "https://docs.databricks.com/aws/en/feed.xml" },
  { name: "BigQuery", category: "platform", type: "feed", url: "https://cloud.google.com/feeds/bigquery-release-notes.xml" },
  // 製品発表がブログで出ることが多いため platform として扱う
  { name: "Google Cloud Data Analytics", category: "platform", type: "feed", url: "https://cloudblog.withgoogle.com/products/data-analytics/rss/" },
  {
    name: "AWS",
    category: "platform",
    type: "feed",
    url: "https://aws.amazon.com/about-aws/whats-new/recent/feed/",
    // 分析系だけに絞る
    include: /redshift|glue|athena|emr|s3 tables|lake formation|datazone|sagemaker unified studio|kinesis|msk|quicksight|opensearch|zero-etl|iceberg/i,
  },

  // 2. OSS（GitHub Releases）
  ...[
    "apache/iceberg",
    "apache/spark",
    "delta-io/delta",
    "apache/airflow",
    "dagster-io/dagster",
    "dbt-labs/dbt",
    "duckdb/duckdb",
    "pola-rs/polars",
    "trinodb/trino",
    "dlt-hub/dlt",
    "apache/arrow",
  ].map((repo) => ({ name: repo, category: "oss", type: "github-releases", repo })),

  // 3. AI × データ（製品リリースノートの AI 関連は生成時に AI 区分へ振り分ける）
  { name: "modelcontextprotocol/modelcontextprotocol", category: "ai", type: "github-releases", repo: "modelcontextprotocol/modelcontextprotocol" },

  // 4. ブログ・記事（Pickup 記事の候補）
  { name: "Data Engineering Weekly", category: "blog", type: "feed", url: "https://www.dataengineeringweekly.com/feed" },
  { name: "benn.substack", category: "blog", type: "feed", url: "https://benn.substack.com/feed" },
  { name: "Netflix Tech Blog", category: "blog", type: "feed", url: "https://netflixtechblog.com/feed" },
  { name: "Zalando Engineering", category: "blog", type: "feed", url: "https://engineering.zalando.com/atom.xml" },
  { name: "Databricks Blog", category: "blog", type: "feed", url: "https://www.databricks.com/feed" },
  { name: "Snowflake Blog", category: "blog", type: "feed", url: "https://www.snowflake.com/feed/" },
  { name: "dbt Blog", category: "blog", type: "feed", url: "https://docs.getdbt.com/blog/rss.xml" },
  { name: "Zenn dbt", category: "blog", type: "feed", url: "https://zenn.dev/topics/dbt/feed" },
  { name: "Zenn Snowflake", category: "blog", type: "feed", url: "https://zenn.dev/topics/snowflake/feed" },
  { name: "Zenn Databricks", category: "blog", type: "feed", url: "https://zenn.dev/topics/databricks/feed" },
  { name: "Zenn データエンジニアリング", category: "blog", type: "feed", url: "https://zenn.dev/topics/dataengineering/feed" },
  { name: "Qiita dbt", category: "blog", type: "feed", url: "https://qiita.com/tags/dbt/feed" },
  { name: "Qiita Snowflake", category: "blog", type: "feed", url: "https://qiita.com/tags/snowflake/feed" },
];
