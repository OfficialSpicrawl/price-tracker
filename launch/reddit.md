# Reddit

Subreddit: r/webscraping. Read the sidebar first: if tool posts are restricted to a monthly promotion thread, post it there instead.

Repo: https://github.com/OfficialSpicrawl/price-tracker
Demo: https://price-tracker.spicrawl.com

## Title

```
Open-source price and stock tracker: JSON-LD first, CSS selectors as fallback
```

## Body

```
I wrote a small Node CLI that tracks product prices and stock from a products.json and alerts (console, Discord, Slack) when a price drops, reaches a target, or an item comes back in stock.

The part that might interest this sub is how it finds the price:

- No selectors: it asks for the page's structured data and reads a schema.org Product/Offer (price, lowPrice, priceCurrency, availability) or OpenGraph product:price:amount. Most shops publish this and it survives redesigns.
- With selectors: you give a CSS selector for the price and the stock text, and only those elements are extracted. It parses "£51.77", "$1,299.00" and "1.299,00 €" into numbers.
- Requests use cache:false, because the API otherwise reuses stored results for up to 48 hours and you would see yesterday's price.
- A page that answers 403/503 is reported as blocked and the saved state is left alone, so a block page is never read as a price.

It fetches through the Spicrawl API (I work on it), so the proxy and rendering side is not in the repo. Free key is 1,000 credits a month, 1 credit per product check, failed requests cost 0.

Limits: one price per page (first offer wins), products are checked sequentially, and a lone "$" is read as USD. No crawling or search: you give it the product URLs.

Repo: https://github.com/OfficialSpicrawl/price-tracker
Check one URL in the browser: https://price-tracker.spicrawl.com
Short demo video in the repo under videos/out.

For pages with no JSON-LD, what do you reach for before writing a selector per site?
```
