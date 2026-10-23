# X

Repo: https://github.com/OfficialSpicrawl/price-tracker
Demo: https://price-tracker.spicrawl.com
Attach the demo video (videos/out, MP4) to post 1 as native video. Upload the file; do not link it.

## Single post

```
price-tracker: a small Node CLI that watches product pages and alerts (Discord, Slack, console) on a price drop, a target price or a restock. 1 credit per product check.

https://github.com/OfficialSpicrawl/price-tracker
Try one URL: https://price-tracker.spicrawl.com
```

## Thread (replies to the single post)

```
1/ List products in products.json. With no selectors it reads the page's JSON-LD / OpenGraph (schema.org Product and Offer), which most shops publish. Otherwise give a CSS selector for the price and the stock text.

node track.mjs
```

```
2/ Real output from the example file (two books on books.toscrape.com):

NAME                  PRICE   CHANGE
A Light in the Attic  £51.77  new
Tipping the Velvet    £53.74  new
Credits used: 2

Run it again later and CHANGE shows what moved.
```

```
3/ Limits: one price per page (first offer wins), products checked one at a time. Free plan: 1,000 credits a month, failed requests cost 0. Ten products daily is ~300 credits.

demo video: https://github.com/OfficialSpicrawl/price-tracker/tree/main/videos/out
```
