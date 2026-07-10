import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: [
    "./db/schema.ts",
    "./auth-schema.ts",  // ← AÑADE ESTE ARCHIVO
  ],
  out: "./drizzle",
  dialect: 'turso',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
    authToken: process.env.DATABASE_AUTH_TOKEN,
  },
});
