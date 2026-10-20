-- 日別のページ表示数（直近30日、bot を除く）
SELECT day, SUM(weight) AS views
FROM pageviews
WHERE time > NOW() - INTERVAL '30' DAY AND device != 'bot'
GROUP BY day
ORDER BY day
