-- よく見られているページ（直近7日、bot を除く）
SELECT path, SUM(weight) AS views
FROM pageviews
WHERE time > NOW() - INTERVAL '7' DAY AND device != 'bot'
GROUP BY path
ORDER BY views DESC
LIMIT 20
