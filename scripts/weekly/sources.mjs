// Weekly Tech Note の情報源（自動収集・Claude による手動作成の両方で使う唯一のリスト）
// category: platform（製品リリースノート）/ oss / ai / blog
// region（blog のみ）: global（海外・公式。Pickup の海外枠）/ ja（国内。Pickup の国内枠）
// url の代わりに urls を書くと、複数のフィードを 1 つの収集元としてまとめる
// include: タイトル・本文がこの正規表現に一致する項目だけを残す（データと関係の薄い記事が多い収集元用）

// 企業の技術ブログ向け: データ基盤・分析・ML 基盤に関する記事だけを残す
const DATA_TOPICS = /\bdata\b|pipeline|warehouse|lakehouse|analytics|spark|kafka|flink|iceberg|delta lake|airflow|dbt|etl|elt|streaming|batch|olap|sql|metric|experimentation|feature store|ml platform|machine learning platform/i;

export const SOURCES = [
  // 1. データ基盤製品（公式リリースノート）
  { name: "Snowflake", category: "platform", type: "snowflake-notes", url: "https://docs.snowflake.com/en/release-notes/new-features" },
  { name: "Databricks", category: "platform", type: "feed", url: "https://docs.databricks.com/aws/en/feed.xml" },
  // BigQuery のリリースノートと、Google Cloud ブログのデータ分析カテゴリ（製品発表がブログで出ることが多い）を 1 つにまとめる
  {
    name: "Google Cloud",
    category: "platform",
    type: "feed",
    urls: ["https://cloud.google.com/feeds/bigquery-release-notes.xml", "https://cloudblog.withgoogle.com/products/data-analytics/rss/"],
  },
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

  // 4. ブログ・記事（Pickup 記事の候補）。海外は記事ページから本文を補って AI に渡す（フィードの要約は短いため）
  // 4-1. 海外: 製品・OSS の公式ブログ
  ...[
    ["Databricks Blog", "https://www.databricks.com/feed"],
    ["Snowflake Blog", "https://www.snowflake.com/feed/"],
    ["AWS Big Data Blog", "https://aws.amazon.com/blogs/big-data/feed/"],
    ["dbt Labs Blog", "https://www.getdbt.com/blog/rss.xml"],
    ["dbt Developer Blog", "https://docs.getdbt.com/blog/rss.xml"],
    ["Dagster Blog", "https://dagster.io/blog/rss.xml"],
    ["DuckDB Blog", "https://duckdb.org/feed.xml"],
    ["MotherDuck Blog", "https://motherduck.com/rss.xml"],
    ["Confluent Blog", "https://www.confluent.io/rss.xml"],
  ].map(([name, url]) => ({ name, category: "blog", region: "global", type: "feed", url })),
  // 4-2. 海外: 企業の技術ブログ（事例）。データ関連の記事に絞る
  ...[
    ["Netflix Tech Blog", "https://netflixtechblog.com/feed"],
    ["Airbnb Engineering", "https://medium.com/feed/airbnb-engineering"],
    ["Pinterest Engineering", "https://medium.com/feed/pinterest-engineering"],
    ["Spotify Engineering", "https://engineering.atspotify.com/feed/"],
    ["Meta Engineering", "https://engineering.fb.com/feed/"],
    ["Analytics at Meta", "https://medium.com/feed/@AnalyticsAtMeta"],
    ["Zalando Engineering", "https://engineering.zalando.com/atom.xml"],
  ].map(([name, url]) => ({ name, category: "blog", region: "global", type: "feed", url, include: DATA_TOPICS })),
  // 4-3. 海外: ニュースレター・個人
  ...[
    ["Data Engineering Weekly", "https://www.dataengineeringweekly.com/feed"],
    ["dbt Roundup", "https://roundup.getdbt.com/feed"],
    ["benn.substack", "https://benn.substack.com/feed"],
    ["Seattle Data Guy", "https://seattledataguy.substack.com/feed"],
  ].map(([name, url]) => ({ name, category: "blog", region: "global", type: "feed", url })),
  // 4-4. 国内
  ...[
    ["Zenn dbt", "https://zenn.dev/topics/dbt/feed"],
    ["Zenn Snowflake", "https://zenn.dev/topics/snowflake/feed"],
    ["Zenn Databricks", "https://zenn.dev/topics/databricks/feed"],
    ["Zenn データエンジニアリング", "https://zenn.dev/topics/dataengineering/feed"],
    ["Qiita dbt", "https://qiita.com/tags/dbt/feed"],
    ["Qiita Snowflake", "https://qiita.com/tags/snowflake/feed"],
  ].map(([name, url]) => ({ name, category: "blog", region: "ja", type: "feed", url })),
];
