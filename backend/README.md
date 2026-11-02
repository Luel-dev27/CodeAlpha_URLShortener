# CodeAlpha URL Shortener

A small URL shortening API built with Node.js, Express, SQLite, nanoid, and Zod.

## Setup

Requires Node.js 18 or newer. From `backend/`:

```sh
cp .env.example .env
npm install
npm run dev
```

The SQLite database is created automatically at `data/urls.sqlite`. Set `DATABASE_PATH` to change it. Configure `PORT` and public `BASE_URL` in `.env`; the default port is 5000. The database and `.env` are excluded from Git.

## API

### `POST /api/urls`

Body: `{"url":"https://www.google.com"}`. Accepts only absolute HTTP or HTTPS URLs (up to 2048 characters). Returns `201` with the original URL, short code, and generated short URL. Invalid input returns `400`.

### `GET /:shortCode`

Redirects to the original URL with `302` and increments its click count. Unknown codes return `404` JSON.

### `GET /api/urls`

Returns stored URLs with their code, creation time, and click count.

### `GET /api/urls/:shortCode`

Returns information for one code, or `404` if it is unknown.

### `GET /api/health`

Returns `{"success":true,"status":"ok"}` while the application is running.

## Commands

- `npm run dev` — start with nodemon
- `npm start` — start the server
- `npm test` — run built-in Node.js tests
