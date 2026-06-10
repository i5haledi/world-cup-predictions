# World Picks

A mobile-first World Cup prediction card for a group of friends.

## Run it

Run the local server:

```powershell
node server.mjs
```

Then open `http://localhost:8000`.

## Deploy

The `api/matches.js` serverless function and `vercel.json` file make the app
ready for deployment on Vercel.

The server loads the real 2026 World Cup schedule from the free
[OpenLigaDB API](https://www.openligadb.de/). No API key is required. Nation
flags are image assets provided by FlagCDN, not emoji.

## Current behavior

- The current World Cup matchday is selected automatically.
- Players enter their name and pick home win, draw, or away win.
- Progress is saved in the browser using `localStorage`.
- Once every match is picked, the app creates a summary.
- On supported phones, Share opens the native share sheet. Otherwise, it opens
  WhatsApp with the prediction text ready to send.

This version does not yet use user accounts or an organizer dashboard.
Predictions are shared through the group chat rather than collected in a
database.
