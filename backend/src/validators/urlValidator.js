import { z } from "zod";

const createUrlSchema = z
  .object({
    url: z
      .string()
      .trim()
      .min(1)
      .max(2048)
      .url()
      .refine((value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, "URL must use http or https")
      .refine((value) => {
        try {
          const url = new URL(value);
          return !url.username && !url.password;
        } catch {
          return false;
        }
      }, "URL must not contain embedded credentials"),
  })
  .strict();

export { createUrlSchema };
