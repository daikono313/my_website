-- 流入元（直近30日、外部サイトのみ）
SELECT referrer, SUM(weight) AS views
FROM pageviews
WHERE time > NOW() - INTERVAL '30' DAY AND referrer != ''
GROUP BY referrer
ORDER BY views DESC
LIMIT 20
