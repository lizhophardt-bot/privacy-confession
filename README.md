# Privacy Confessions

> **Status:** Event prototype — not production-hardened. Keep it simple.

An anonymous confession wall for DappCon 2026. Submissions are held for manual admin approval before appearing publicly on the wall.

## Pages

- `/` — submit a confession (up to 1000 characters)
- `/wall` — public display that polls for new approved confessions every 10 seconds
- `/admin` — moderation panel (password protected)

## Running locally

```bash
npm install
npm start
```

Server starts on `http://localhost:3000`.

## Admin panel

Visit `/admin` and enter the admin password to moderate submissions.

- **Pending** — new submissions awaiting review; approve or delete
- **Approved** — live on the wall; can be unapproved or deleted
- **Download DB** — downloads `confessions.json` as a backup

Set the password via env var: `ADMIN_PASSWORD=yourpassword npm start`

## Configuration

| Env var | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `ADMIN_PASSWORD` | *(required)* | Admin panel password |

## Stack

- **Backend:** Node.js + Express
- **Database:** JSON flat file (`confessions.json`) — no setup needed
- **Frontend:** Vanilla HTML/CSS/JS — no build step, no framework

## What's intentionally missing (prototype scope)

- No rate limiting
- No HTTPS — add a reverse proxy (nginx/Caddy) if deploying publicly
