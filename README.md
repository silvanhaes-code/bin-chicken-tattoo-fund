# Josh's Bin Chicken Tattoo Fund 🐦

A very small fundraiser app for one very specific cause: **11 mates, $200 AUD,
one bin chicken tattoo on Josh's ankle.**

![The plan](assets/ankle-tattoo.svg)

## What it does

- **11 pledge spots.** Everyone types in their name and what they're good for.
- **A very clear "still to go".** Big running total, the amount left to raise, a
  progress bar with a bin chicken walking along it, and a row of 11 bin chicken
  icons that light up as each mate chips in.
- **Split evenly** divides the $200 across all 11 to the cent
  ($18.19 × 2 + $18.18 × 9 = exactly $200).
- **Goal reached** → the bird does a little jig and the app says so. Overshoot
  and it tells you how far over you are.
- **Saved on the phone.** Pledges live in `localStorage`. It's an honesty box
  for tracking who's in, not a payment system — no money changes hands here.

## Install it on an iPhone

Open the site in Safari → Share → **Add to Home Screen**. It runs full screen,
has its own icon, and works offline (service worker + manifest).

## Tech

Plain static site: one HTML file, one stylesheet, one ES module. No build step,
no dependencies, no tracking. The artwork (the bin chicken icon and the
tattooed ankle) is hand-drawn SVG.

```
index.html              The app
css/app.css             Styles (light + dark)
js/app.js               Pledges, totals, progress, storage
assets/bin-chicken.svg  The bin chicken (Australian white ibis)
assets/ankle-tattoo.svg The ankle, wearing the tattoo
assets/icon*.png|svg    App icons
manifest.webmanifest    PWA manifest
sw.js                   Service worker (offline)
```

## Run locally

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment (GitHub Pages)

`.github/workflows/deploy-pages.yml` publishes the site on every push to `main`.
**One-time setup:** in the repository, go to **Settings → Pages → Build and
deployment → Source: GitHub Actions**. The app is then live at
`https://silvanhaes-code.github.io/bin-chicken-tattoo-fund/`.
