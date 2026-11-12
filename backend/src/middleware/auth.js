import { createHash, timingSafeEqual } from "node:crypto";

const digest = (value) => createHash("sha256").update(value).digest();

export function requireAdmin(apiKey) {
  const expected = apiKey ? digest(apiKey) : null;
  return (req, res, next) => {
    if (!expected)
      return res
        .status(503)
        .json({
          success: false,
          error: "Link administration is not configured",
        });
    const header = req.get("authorization") || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token || !timingSafeEqual(digest(token), expected)) {
      res.set("WWW-Authenticate", "Bearer");
      return res
        .status(401)
        .json({
          success: false,
          error: "A valid administrator key is required",
        });
    }
    return next();
  };
}
