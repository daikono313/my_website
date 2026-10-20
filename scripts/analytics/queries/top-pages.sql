-- よく見られているページ（直近7日、bot を除く）
SELECT blob1 AS path, SUM(_sample_interval) AS views
FROM my_website_pageviews
WHERE timestamp > NOW() - INTERVAL '7' DAY AND blob5 = 'de.daisuke-harato.workers.dev' AND blob4 != 'bot'
GROUP BY path
ORDER BY views DESC
LIMIT 20
