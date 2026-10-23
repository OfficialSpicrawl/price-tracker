# Show HN

Repo: https://github.com/OfficialSpicrawl/price-tracker
Demo: https://price-tracker.spicrawl.com

## Title

```
Show HN: price-tracker, a CLI that alerts on price drops and restocks
```

URL field: https://github.com/OfficialSpicrawl/price-tracker

## First comment (post it right after submitting)

```
Hi HN, I'm the maker. price-tracker is one Node file (track.mjs) that reads a products.json, checks each product page and prints a table of price, change since the last check, and stock. It alerts, to the console and optionally to Discord or Slack, when the price is lower than last time, at or below a target you set, or an item goes from out of stock to in stock. Run it once from cron or loop with --every 30m. There is a page where you can check a single URL without installing anything (https://price-tracker.spicrawl.com) and a short demo video in the repo (videos/out).

How it works: I work on Spicrawl, the scraping API it calls. With no selectors, the request asks Spicrawl for the page's structured data (JSON-LD, OpenGraph, microdata) and the tool looks for a schema.org Product/Offer, which most shops publish and which survives redesigns. For pages without it, you give a CSS selector for the price and one for the stock text, and Spicrawl extracts just those elements. Requests use mode "auto" (plain fetch first, JavaScript rendering only if needed) and cache:false, because the API would otherwise reuse a stored result for up to 48 hours and show you an old price.

Limits: it is one price per page (the first offer found wins), products are checked one after another, and a page that answers 4xx/5xx is reported as such and does not touch the saved state. The free plan is 1,000 credits a month, a plain fetch is 1 credit, JS rendering is 3, and failed requests cost 0; ten products checked daily is about 300 credits. Spicrawl has no crawl, search or AI extraction yet, so you supply the product URLs and, for pages without structured data, the selectors. Repo: https://github.com/OfficialSpicrawl/price-tracker
```
