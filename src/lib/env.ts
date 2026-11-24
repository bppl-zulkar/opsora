import { z } from "zod";
const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(10),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(10).optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("Asia/Kolkata"),
});
export function publicEnv() {
  return schema
    .pick({
      NEXT_PUBLIC_SUPABASE_URL: true,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
      NEXT_PUBLIC_APP_URL: true,
      APP_TIMEZONE: true,
    })
    .parse(process.env);
}
export function serverEnv() {
  return schema.parse(process.env);
}
