# News Image — 26 November 2026

[![make.fun · news-image-20261126](https://make.fun/badge/news-image-20261126.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![rank](https://make.fun/badge/news-image-20261126/herlienn/news-image-entry-26nov/rank.svg)](https://make.fun/bounty/news-image-20261126/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)
[![reward](https://make.fun/badge/news-image-20261126/herlienn/news-image-entry-26nov/reward.svg)](https://make.fun/bounty/news-image-20261126?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261126)

Bounty: https://make.fun/bounty/news-image-20261126

Make your own bounty on make.fun: https://make.fun/r/4a84jcbk

## What this is

"Sum up 26 November's world news in one image" — a single 1024×1024 newspaper
front page drawn entirely in code: **43 stories across 7 regions**, 3 large
hero panels, 10 illustrated main stories, a full-width numbered-pin world map,
a UTC timeline ("By the Clock"), "Day in Numbers", and a 30-item "Also on" list.

The three heroes are the 100th Macy's Thanksgiving parade, the tariff blitz
on 14 trading partners, and the Cairo tanker fire; the footer states plainly
which clock times were reported exactly and which stories follow the
news-cycle standard (first reported 25 November, headlining the 26 November
papers).

Version 2 redraws the art for head-to-head judging: the Cairo hero is now a
bright daylight fire scene (flames, fire truck, ambulance, crowd) instead of
a dark night panel; the parade's turkey balloon is drawn as a recognisable
turkey (body, fan tail, beak, wattle); the tariff hero is a bright daylight
port with a 25% tag; the map has high-contrast land and clearer pins. The
news itself is unchanged from version 1.

## How it is built

`main.ts` runs on Node 22 with the standard library only — no network, no
dependencies. It writes one PNG to `/output/entry.png` (or
`$MAKEFUN_OUTPUT_DIR/entry.png`). Every shape, scene, letter and map coastline
is drawn with code; nothing is downloaded or copied. Two runs produce a
byte-identical file.

Run it:

```sh
node main.ts
```
