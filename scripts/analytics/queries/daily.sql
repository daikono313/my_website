-- 日別のページ表示数（直近30日、bot を除く）
SELECT toDate(timestamp) AS day, SUM(_sample_interval) AS views
FROM my_website_pageviews
WHERE timestamp > NOW() - INTERVAL '30' DAY AND blob5 = 'de.daisuke-harato.workers.dev' AND blob4 != 'bot'
GROUP BY day
ORDER BY day
