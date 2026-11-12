function integer(value, fallback, name, max = Number.MAX_SAFE_INTEGER) {
  const raw = String(value ?? fallback);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    Number(raw) < 1 ||
    Number(raw) > max
  ) {
    throw new Error(`${name} must be an integer between 1 and ${max}`);
  }
  return Number(raw);
}

function origin(value, name) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) origin`);
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  ) {
    throw new Error(
      `${name} must be an HTTP(S) origin without credentials, path, query, or fragment`,
    );
  }
  return url.origin;
}

export function loadConfig(env = process.env) {
  const port = integer(env.PORT, 5000, "PORT", 65535);
  const adminApiKey = env.ADMIN_API_KEY || "";
  if (
    adminApiKey &&
    (adminApiKey.trim() !== adminApiKey || adminApiKey.length < 32)
  ) {
    throw new Error(
      "ADMIN_API_KEY must contain at least 32 characters without surrounding whitespace",
    );
  }
  return {
    port,
    baseUrl: origin(env.BASE_URL || `http://localhost:${port}`, "BASE_URL"),
    databasePath: env.DATABASE_PATH || undefined,
    adminApiKey,
    allowedOrigins: (env.CORS_ORIGINS || "http://localhost:5173")
      .split(",")
      .map((value) => origin(value.trim(), "CORS_ORIGINS")),
    rateLimitWindowMs: integer(
      env.RATE_LIMIT_WINDOW_MS,
      900000,
      "RATE_LIMIT_WINDOW_MS",
      2147483647,
    ),
    rateLimitMax: integer(env.RATE_LIMIT_MAX, 300, "RATE_LIMIT_MAX"),
    createRateLimitMax: integer(
      env.CREATE_RATE_LIMIT_MAX,
      20,
      "CREATE_RATE_LIMIT_MAX",
    ),
  };
}
