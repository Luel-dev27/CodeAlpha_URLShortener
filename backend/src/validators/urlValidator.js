const { z } = require('zod');

const createUrlSchema = z.object({
  url: z.string().trim().min(1).max(2048).url().refine((value) => {
    try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
  }, 'URL must use http or https'),
}).strict();

module.exports = { createUrlSchema };
