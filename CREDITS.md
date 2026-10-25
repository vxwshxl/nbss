# Credits & licences

Every third-party asset bundled in this repository is either public domain or
carries a permissive / Creative Commons licence. Attribution is rendered in the
UI where a licence requires it. The photographs are all NBSS's own (below).

## Typefaces

Self-hosted as a variable `woff2` under `public/fonts/`, taken from the `geist`
npm package (v1.7.2). Licensed under the **SIL Open Font License 1.1**.

| Family | Role | Source |
| --- | --- | --- |
| Geist Sans | Headings, body copy, and codes and figures (tabular) | [vercel/geist-font](https://github.com/vercel/geist-font) |

Geist Mono is not used: its slashed zero read as code in employee codes and phone numbers.

The colour ramps, radius and elevation in `src/app/globals.css` follow Vercel's
published [Geist design system](https://vercel.com/geist/colors). Geist is used
here as an open design system; NBSS is not affiliated with Vercel.

## Runtime dependencies

| Package | Licence |
| --- | --- |
| [next](https://nextjs.org) | MIT |
| [react](https://react.dev) | MIT |
| [react-dom](https://react.dev) | MIT |

Three packages, no UI library, no CSS framework, no icon package. Every component,
icon and stylesheet in `src/` is original code.

## Photographs

### Supplied by the client — © National Bodo Security Service

These are NBSS's own photographs of its guards, parades and postings, supplied
by the client for use on this site. They are **not** Creative Commons licensed
and must not be reused outside this project. The gallery prints the company name
beneath each one rather than a third-party credit and licence.

| File | Subject |
| --- | --- |
| `img/nbss/parade-salute.jpg` | Evening parade, turnout and salute |
| `img/nbss/parade-night.jpg` | Parade inspection at full strength |
| `img/nbss/parade-ranks.jpg` | Drill ranks with batons |
| `img/nbss/guards-on-duty.jpg` | Gate duty at a public building, Kokrajhar |
| `img/nbss/training-classroom.jpg` | Classroom training session |
| `img/nbss/training-briefing.jpg` | Emergency response briefing with SDRF Assam |
| `img/nbss/training-demo.jpg` | Rescue equipment demonstration, SDRF Assam |
| `img/nbss/stadium-*.webp`, `cam-main.webp` | Event duty at a floodlit stadium |
| `img/nbss/assembly-road.webp`, `field-formation.webp`, `batch-*.webp`, `formation-trees.webp` | The company assembled, batches and drill |
| `img/nbss/hall-gate.webp`, `hall-wide.webp`, `vest-team.webp`, `line-women.webp`, `cam-event.webp` | Postings at public buildings |
| `img/nbss/guard-portrait.webp`, `woman-guard*.webp`, `waterpark-team.webp` | Guards on post, a water park |
| `img/nbss/flag-hoisting.webp`, `flag-day.webp` | Flag hoisting at a client's showroom |
| `img/nbss/classroom-*.webp` | Recruit classroom sessions |
| `img/nbss/construction-guard.webp` | Construction site posting |
| `video/nbss-parade.mp4` | NBSS parade footage, Kokrajhar |
| `video/nbss-drill.mp4` | Recruit drill, Kokrajhar |
| `logo/NBSS.png` | The company badge — source artwork |

The badge is the client's trademark. Everything under `public/logo/nbss-*`, plus
`favicon.ico`, `icon-*.png` and `apple-touch-icon.png`, is generated from it by
`scripts/generate-logo-assets.mjs` and carries the same restriction.

Every photograph on the site is one of these. There is no stock photography.

## Original work

The `nbss-banner.svg` README header, the Aronai band motif, the 45-glyph icon
set, the stylesheet and all TypeScript in this repository are original to this
project.

The **NBSS badge is not** — it is the client's own mark, supplied as
`public/logo/NBSS.png`. See the section above.

## A note on the CC BY-SA images

The photographs above are used unmodified apart from resizing and re-encoding,
and are displayed with attribution and licence alongside each one. If you fork
this project and publish it, keep the credits — that is the whole deal.
