// GET /llms.txt: the tool described for an AI agent. Everything here is in the README and SKILL.md; keep it in step with them.
export const LLMS = `# Spicrawl price tracker

> Open-source price and stock monitor. It reads a product page's structured data (JSON-LD, OpenGraph, microdata) or the CSS selectors you give it with the Spicrawl web scraping API, and alerts on Discord or Slack when a price drops, reaches a target, or an item is back in stock. One file (track.mjs), Node.js 18 or later, Apache-2.0.

## Install

- Agent skill (Claude Code, Codex, Cursor and more): run \`npx skills add OfficialSpicrawl/price-tracker\`, then \`npm install\` in the installed folder.
- Command line: \`git clone https://github.com/OfficialSpicrawl/price-tracker\`, \`cd price-tracker\`, \`npm install\`, \`export SPICRAWL_API_KEY=...\`, \`node track.mjs\`.
- A free Spicrawl API key (1,000 credits a month) comes from https://app.spicrawl.com. If SPICRAWL_API_KEY is not set, ask the user to export it. Never ask them to paste the key into chat.

## Use

- Run from the folder that holds track.mjs: \`products.json\` and \`.prices.json\` are read from the current directory.
- \`products.json\` is a non-empty array. Each item: \`url\` (required), \`name\`, \`target\` (alert at or below this number), \`price\` and \`stock\` (CSS selectors, for pages without structured data).
- \`node track.mjs\` checks every product once and prints NAME, PRICE, CHANGE, STOCK and NOTE, then \`Credits used: N (M left this month)\`.
- \`node track.mjs --every 30m\` keeps running (units s, m or h). Use 15 minutes or more.
- The first check of a product is the baseline: no drop or stock alert. A target alert still fires if the price is already at or below it.
- Alerts: set \`DISCORD_WEBHOOK_URL\` and/or \`SLACK_WEBHOOK_URL\`. One message per run. Cron and GitHub Actions run it on a schedule.

## Cost and limits

- A plain fetch costs 1 credit per product per check. A page that needs JavaScript rendering costs more. Failed requests cost 0.
- Ten products once a day is about 300 credits a month. Give the user that estimate before starting a schedule.
- One price per page. A blocked page is final: do not retry it or try to get around the block.
- Only track pages the user may fetch, and respect each site's terms and robots rules.

## Links

- [README](https://github.com/OfficialSpicrawl/price-tracker#readme)
- [SKILL.md](https://github.com/OfficialSpicrawl/price-tracker/blob/main/SKILL.md)
- [Spicrawl docs](https://docs.spicrawl.com)
- [Live demo](https://price-tracker.spicrawl.com)
`;
