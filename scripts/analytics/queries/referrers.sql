-- 流入元（直近30日、外部サイトのみ）
SELECT blob2 AS referrer, SUM(_sample_interval) AS views
FROM my_website_pageviews
WHERE timestamp > NOW() - INTERVAL '30' DAY AND blob5 = 'de.daisuke-harato.workers.dev' AND blob2 != ''
GROUP BY referrer
ORDER BY views DESC
LIMIT 20
