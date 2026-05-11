# Pebblestones LittleLoop Demo

Mobile-first creche communication demo tailored for Pebblestones.

## Live Demo Locally

```bash
python -m http.server 4173 --bind 127.0.0.1
```

Open:

`http://127.0.0.1:4173/index.html`

## V1 Includes

- Role picker for client pitch mode
- Pebblestones class setup for five age groups
- Pebblestones website-aligned language and daily routine
- Pebble Stones-specific pitch panel for a first-client walkthrough
- Parent daily timeline
- Private moments gallery
- Billing and receipt view
- Teacher quick actions that update parent timeline
- Owner dashboard
- Role switching and browser-persisted demo state

## Deployment

This is a static site. Deploy it as a DigitalOcean App Platform static site with:

- Source directory: `/`
- Output directory: `/`
- Build command: leave blank
- Run command: none
