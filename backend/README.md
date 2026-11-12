# CodeAlpha URL Shortener

An internship portfolio project that turns long HTTP/HTTPS addresses into short, shareable links. The Express API stores mappings in SQLite, redirects visitors, and counts redirect requests. A responsive React interface supports creation, copying, opening links, and administrator-only statistics.

Repository: [Luel-dev27/CodeAlpha_URLShortener](https://github.com/Luel-dev27/CodeAlpha_URLShortener). This is the configured Git remote; local changes are not automatically committed or pushed.

## Features

- Public URL creation with seven-character Nanoid codes and up to five collision attempts.
- Persistent SQLite mappings, unique codes, UTC creation timestamps, and click counts.
- Temporary redirects with `Cache-Control: no-store` so clients are instructed not to cache them.
- Transactional mapping lookup and click updates; HEAD requests do not increment counts.
- Zod validation: absolute HTTP(S) URL, trimmed input, maximum 2,048 characters, no embedded credentials or additional request fields.
- Administrator-only listing and link details, using a Bearer API key.
- Helmet headers, an explicit CORS origin allowlist, a 10 KB JSON body limit, and per-IP request limits.
- Consistent JSON errors, database readiness checks, configuration validation, and graceful shutdown.
- Responsive React forms, copy/open actions, accessible status messages, and a protected statistics table.

## Technology and compatibility

Backend: Node.js, JavaScript ES modules, Express 5, better-sqlite3, Zod, Nanoid, Helmet, cors, and express-rate-limit. Frontend: React and Vite 6. Tests use Node's test runner, real HTTP requests, and temporary/in-memory databases.

Developed and verified on **Node.js 20.20.2 and npm 11.21.1**. No Node/npm upgrade is required for that environment. The earlier Node 18 README requirement was inaccurate for the installed better-sqlite3 dependency. Development uses Node's built-in `--watch` mode instead of nodemon.

## Project structure

```text
CodeAlpha_URLShortener/
└── backend/
    ├── .env.example
    ├── .gitignore
    ├── README.md
    ├── package.json / package-lock.json
    ├── data/urls.sqlite             # ignored local data; do not delete to reset setup
    ├── src/
    │   ├── server.js                # configuration, listener, shutdown
    │   ├── app.js                   # application assembly and middleware
    │   ├── config/
    │   │   ├── database.js          # SQLite connection and initial schema
    │   │   └── environment.js       # validated environment settings
    │   ├── controllers/urlController.js
    │   ├── routes/urlRoutes.js
    │   ├── services/urlService.js
    │   ├── validators/urlValidator.js
    │   └── middleware/
    │       ├── auth.js
    │       ├── rateLimiter.js
    │       └── errorHandler.js
    ├── test/
    │   ├── url.test.js
    │   ├── config.test.js
    │   ├── server.test.js
    │   ├── frontend.integration.js
    │   └── browser.integration.js
    └── frontend/
        ├── .env.example
        ├── index.html
        ├── package.json / package-lock.json
        ├── vite.config.js
        ├── src/
        │   ├── main.jsx
        │   ├── App.jsx
        │   ├── api.js
        │   └── styles.css
        └── test/api.test.js
```

The frontend is nested inside `backend/frontend` to keep the existing backend layout and commands intact. It has its own package and lockfile.

## Installation

From the repository root:

```sh
cd backend
npm ci
```

If `.env` does not already exist, copy the template. Preserve an existing `.env` and database:

```sh
cp -n .env.example .env
```

Generate a private administrator key locally:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Paste the generated value into `ADMIN_API_KEY` in `backend/.env`. Do not commit it, include it in screenshots, put it in a URL, or add it to frontend environment variables. A local key may already have been configured during project setup; use that existing value rather than replacing it unnecessarily.

Install the frontend:

```sh
npm ci --prefix frontend
```

No external database service is needed. SQLite creates its folder and table automatically; existing rows are preserved.

## Environment configuration

Backend `.env` is loaded when starting `src/server.js`. Run backend commands from `backend/`.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `5000` | Integer HTTP port from 1 to 65535. |
| `BASE_URL` | `http://localhost:<PORT>` | Public backend origin used in returned short URLs. Must be HTTP(S), without credentials, a path, query, or fragment. |
| `DATABASE_PATH` | `backend/data/urls.sqlite` | SQLite file. A supplied relative path is resolved from the working directory. `:memory:` is used in tests. |
| `ADMIN_API_KEY` | blank | At least 32 characters without surrounding whitespace. Blank disables administration with HTTP 503. |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated browser origins. Wildcards are not accepted. |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Request limit window in milliseconds (15 minutes). |
| `RATE_LIMIT_MAX` | `300` | General request allowance per client IP, per window. Health checks and CORS preflights are excluded. |
| `CREATE_RATE_LIMIT_MAX` | `20` | Additional per-IP allowance for POST `/api/urls`. Invalid submissions also consume this allowance. |

If you change `PORT`, update `BASE_URL` in an existing `.env` to match. The application does not configure DNS or HTTPS simply by changing `BASE_URL`.

Frontend configuration is optional. Copy `frontend/.env.example` to `frontend/.env` only when changing its proxy target:

```env
API_PROXY_TARGET=http://127.0.0.1:5000
```

Vite proxies `/api` to Express. React uses relative API URLs; it never receives the backend environment file. Short links point directly to the backend's `BASE_URL`.

## Run locally

Terminal 1, from `backend/`:

```sh
npm run dev
```

Terminal 2, from `backend/`:

```sh
npm run dev --prefix frontend
```

Open **http://localhost:5173**. The backend listens at **http://localhost:5000** by default. Opening the backend root is not a frontend page; it returns a JSON 404.

To run without backend watch mode:

```sh
npm start
```

To build and preview the frontend locally while the backend is running:

```sh
npm run build --prefix frontend
npm run preview --prefix frontend
```

Vite prints the preview address (normally port 4173). Its configured API proxy also works in preview. `vite preview` is a local verification server, not a production hosting configuration.

## Frontend workflow

1. Enter an absolute HTTP/HTTPS destination and select **Shorten link**.
2. Copy the returned link or open it in a new tab. Clipboard access depends on browser permissions and a secure context; manual selection remains available.
3. Open **Unlock statistics** and enter the administrator key from the local backend `.env`.
4. View saved destinations, click counts, and per-link creation details. Refresh after opening a short link to see updated counts.
5. Select **Lock**, close the administration panel, or reload the page to clear the key and private data from React state.

The key is held in memory only; it is not stored in cookies, localStorage, or sessionStorage. The API independently authorizes each private request. This is a single-administrator project, not a user-account or multi-tenant system.

## API documentation

All JSON responses use `success` and either `data` or `error`. The existing creation, listing, detail, and redirect response formats remain intact. **Security change:** listing and detail endpoints now require a Bearer administrator key because their previous public access exposed all stored destinations and statistics.

| Method | Path | Access | Result |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | 200 application/database readiness response. |
| POST | `/api/urls` | Public, rate limited | 201 short-link data. |
| GET | `/api/urls` | Administrator | 200 array, newest first. |
| GET | `/api/urls/:shortCode` | Administrator | 200 metadata or 404. |
| GET | `/:shortCode` | Public, rate limited | 302 redirect and one click increment, or 404. |
| HEAD | `/:shortCode` | Public, rate limited | Redirect headers without a click increment. |

### Create

```sh
curl -i http://localhost:5000/api/urls \
  -H 'Content-Type: application/json' \
  --data '{"url":"https://example.com/articles/javascript"}'
```

Illustrative response (the actual code is random):

```json
{
  "success": true,
  "data": {
    "originalUrl": "https://example.com/articles/javascript",
    "shortCode": "aB3_xY7",
    "shortUrl": "http://localhost:5000/aB3_xY7"
  }
}
```

### Visit

```sh
curl -i http://localhost:5000/aB3_xY7
```

For an existing code, the response is HTTP 302 with a `Location` header containing the original URL. Use `curl -I` for a HEAD request that does not increment clicks.

### Administrator reads

Set `ADMIN_API_KEY` in your terminal session from your local configuration before these commands. The placeholders below do not contain an actual credential. Do not share verbose curl output containing authorization headers.

```sh
curl http://localhost:5000/api/urls \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"

curl http://localhost:5000/api/urls/aB3_xY7 \
  -H "Authorization: Bearer ${ADMIN_API_KEY}"
```

Illustrative detail response:

```json
{
  "success": true,
  "data": {
    "originalUrl": "https://example.com/articles/javascript",
    "shortCode": "aB3_xY7",
    "createdAt": "2026-11-12T08:00:00.000Z",
    "clicks": 1
  }
}
```

Listing returns an array of these objects. Creation alone returns the computed `shortUrl`; metadata reads retain the existing response shape.

### Errors

| Status | Meaning |
| --- | --- |
| 400 | Invalid URL/body, unknown fields, or malformed JSON. Validation failures include `details` with field paths and messages. |
| 401 | Missing or incorrect administrator credential. |
| 404 | Unknown short code or route. |
| 413 | JSON body exceeds 10 KB. |
| 429 | Request allowance exceeded; check `Retry-After`. |
| 500 | Unexpected database/application failure; internal details are hidden. |
| 503 | Administration disabled, or five short-code attempts collided. Collision exhaustion uses the generic server-error body. |

Example unknown-code error:

```json
{"success":false,"error":"Short URL not found"}
```

## Architecture and database

```text
React → Vite /api proxy → Express middleware → routes → controller
                                                      ↓ validation
                                                   UrlService
                                                      ↓ prepared SQL
                                                    SQLite

Short-link visitor → Express redirect controller → transactional lookup/count → 302
```

The `urls` table contains `id`, `original_url`, `short_code`, `created_at`, and `clicks`. Codes are unique; required fields cannot be NULL; clicks cannot be negative. The same destination can have multiple short codes. URL syntax validation happens in the HTTP layer. The database uses WAL, a 5-second busy timeout, and transactions for redirect lookup/counting. Prepared statements bind client values separately from SQL.

Initialization only creates an absent table. There are no destructive migrations, reset commands, or changes to existing rows during setup. Back up a live SQLite database using SQLite's backup API or stop the server before copying it; do not copy just the main file while ignoring an active WAL.

## Testing

From `backend/`, after installing both packages:

```sh
npm test
npm test --prefix frontend
npm run test:integration
npm run build --prefix frontend
# Optional: requires an existing Firefox and geckodriver installation
npm run test:browser
npm audit
npm audit --prefix frontend
```

- Backend tests cover creation, validation, redirects, accurate counts, HEAD behavior, missing codes, collision retries/exhaustion, safe database errors, failed update rollback, authorization, disabled administration, ordering, rate limits, CORS, body limits, environment validation, persistence, startup failure, occupied ports, and SIGTERM shutdown.
- Frontend tests cover the API client's payloads, authorization headers, URL encoding, and user-facing error propagation.
- Integration tests run a real Express server and Vite proxy, transform the React entry, and execute the frontend API client against the backend for creation, redirects, statistics, and denied access.
- Tests use temporary or in-memory databases. They do not modify `data/urls.sqlite`.
- Integration tests require permission to bind local HTTP ports. A restricted sandbox can block them even when the code is correct.

The optional `test:browser` command uses an existing Firefox/geckodriver installation through the WebDriver HTTP protocol; it never downloads a browser. Set `GECKODRIVER_PATH` if the executable is not on PATH. It checks creation, opening a destination in a new tab, click counts, invalid and valid administrator keys, details, locking, URL errors, and narrow-screen overflow. Clipboard success/failure branches use a deterministic clipboard double; native OS clipboard permissions still need a manual check. Screenshots are written to `/tmp/codealpha-desktop.png` and `/tmp/codealpha-mobile.png`, outside the repository. A restricted sandbox may require permission to start the installed browser.

### Verification recorded on 12 November 2026

| Check | Result |
| --- | --- |
| Backend suite | 21 tests passed |
| Frontend API client | 2 tests passed |
| Real Vite/Express integration | 1 test passed |
| Firefox UI workflow | 1 test passed |
| Vite production build | Passed on Node.js 20.20.2 |
| Backend dependency audit | 0 reported vulnerabilities |
| Frontend dependency audit | 0 reported vulnerabilities |
| Existing SQLite integrity check | `ok`; existing record preserved |

These results describe the installed dependency set and checks actually executed, not a guarantee about future dependency changes. Native clipboard access and a public HTTPS deployment were not verified. No deployment was performed.

## Security and scope limits

- All metadata reads require the administrator key. Short links are intentionally public redirects: anyone who possesses or discovers a code can resolve its destination. Do not use this application to conceal confidential URLs.
- Keep the key in the ignored backend `.env`. Rotate it by changing that value and restarting the backend. Use HTTPS before sending it over a public network.
- Rate limits use an in-process memory store and reset on restart. This setup targets one server process. Shared stores and audited reverse-proxy configuration are needed before multiple-instance deployment. `trust proxy` is deliberately not enabled blindly.
- CORS controls browser response access, not authentication. Non-browser clients can still call public endpoints.
- Destinations are not fetched by the backend, checked for reachability, or screened for phishing. HTTP(S) validation does not establish that a site is safe. No private-IP filtering is promised.
- Clicks mean successful redirect handling, including repeat visits and bots; they are not unique visitors or confirmed destination loads. HEAD and metadata reads do not count.
- Listing is administrator-only but unpaginated. This is suitable for a small portfolio dataset, not an unlimited production dataset.
- No accounts, password login, expiration, custom aliases, editing, deletion, or detailed event analytics are included.
- SQLite is local file storage without application-level encryption. Protect file permissions and backups. Synchronous queries suit this small application; high-volume scaling needs separate assessment.
- Frontend production hosting and HTTPS are not deployed by this repository. A future static host must forward `/api` to the backend; returned short links must use the public backend origin.

## Submission checklist

1. Install from both lockfiles using `npm ci` and `npm ci --prefix frontend`.
2. Configure the ignored backend `.env`, including the public origin if hosting later.
3. Run all tests and the frontend build above on the installed Node version.
4. Perform the manual browser checks, including an unauthorized statistics request.
5. Review `git status` and `git diff`; verify no `.env`, SQLite files, node_modules, or build output are staged.
6. Capture screenshots without the administrator key or confidential destinations.
7. Commit the source, templates, documentation, tests, and both lockfiles, then push only when ready. No deployment or push is automatic.
