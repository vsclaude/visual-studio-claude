-- Converts every balance from credits sold at 2.000 ₫ to the dollar
-- (Anthropic's list price, through a gateway) to the same money at
-- 30.000 ₫ to the dollar of DeepSeek's list price: divided by 15.
--
-- `used` is divided too, so the share of what was bought that is left — the
-- bars in the studio — does not jump. `transactions.credits` is left as the
-- record of what each purchase added at the time.
--
-- Run once, when the server is switched to DeepSeek:
--
--   wrangler d1 execute vsclaude --remote --file scripts/deepseek-credits.sql
--
-- A second run changes nothing: the marker row is what the update checks.

CREATE TABLE IF NOT EXISTS migrations (name TEXT PRIMARY KEY, at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

UPDATE users SET credits = credits / 15, used = used / 15
WHERE NOT EXISTS (SELECT 1 FROM migrations WHERE name = 'deepseek-credits');

INSERT OR IGNORE INTO migrations (name) VALUES ('deepseek-credits');
