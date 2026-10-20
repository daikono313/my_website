-- 仮想ビュー pageviews（Analytics Engine は CREATE VIEW 非対応のため、query.sh が FROM pageviews をこのサブクエリに展開する）
-- 本番ホストだけに絞り、列に名前を付け、時刻を日本時間にする
SELECT
  toDateTime(timestamp, 'Asia/Tokyo') AS time,
  toDate(toDateTime(timestamp, 'Asia/Tokyo')) AS day,
  blob1 AS path,
  blob2 AS referrer,
  blob3 AS country,
  blob4 AS device,
  _sample_interval AS weight
FROM my_website_pageviews
WHERE blob5 = 'de.daisuke-harato.workers.dev'
