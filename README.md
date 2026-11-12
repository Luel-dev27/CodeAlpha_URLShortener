# CodeAlpha URL Shortener

A Node.js/Express and SQLite URL shortening API with a React/Vite interface, protected administrator statistics, input validation, and rate limiting.

**[Read the complete project documentation](backend/README.md)** for installation, environment configuration, API examples, architecture, security limits, tests, and the submission checklist.

Verified runtime: Node.js 20.20.2 and npm 11.21.1.

```sh
cd backend
npm ci
npm ci --prefix frontend
# Create .env from .env.example only if .env does not already exist.
# Configure a private ADMIN_API_KEY as described in backend/README.md.
npm run dev
```

In another terminal, from `backend/`, run `npm run dev --prefix frontend` and open http://localhost:5173.

Run checks from `backend/`:

```sh
npm test
npm test --prefix frontend
npm run test:integration
npm run build --prefix frontend
```

Repository: [Luel-dev27/CodeAlpha_URLShortener](https://github.com/Luel-dev27/CodeAlpha_URLShortener).

Local environment files, SQLite data, dependencies, and build output are ignored. Do not commit credentials or private destinations. Nothing is pushed or deployed automatically.
