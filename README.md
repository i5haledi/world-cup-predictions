# World Picks

A mobile-first Arabic World Cup prediction competition for a group of friends.

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

## Accounts and leaderboard

- Users register with a username and password.
- Passwords are hashed with Node.js `scrypt`.
- Sessions use signed, HTTP-only cookies.
- Predictions are stored in Neon PostgreSQL.
- Exact scores award 3 points; a correct outcome awards 1 point.
- Manual round scores override automatic scoring for that round.
- The reserved admin username is configured through `ADMIN_USERNAME`.

## Current behavior

- The current World Cup matchday is selected automatically.
- Players enter their name and pick home win, draw, or away win.
- Progress is saved in the browser using `localStorage`.
- Once every match is picked, the app creates a summary.
- On supported phones, Share opens the native share sheet. Otherwise, it opens
  WhatsApp with the prediction text ready to send.

The app includes an admin page for assigning the first round's historical
scores and a leaderboard page that combines manual and automatic points.
