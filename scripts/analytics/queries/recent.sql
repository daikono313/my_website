-- 直近のアクセス一覧（新しい順に50件）
SELECT time, path, referrer, country, device
FROM pageviews
ORDER BY time DESC
LIMIT 50
