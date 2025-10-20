import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { pool } from "./db";
import "dotenv/config";

const app = new Hono();

app.get("/api/search", async (c) => {
  const postalCode = c.req.query("postalCode");
  if (!postalCode) return c.json({ error: "Missing postalCode" }, 400);

  // Step 1: Geocode postal code using OpenCage
  const geoRes = await fetch(
    `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
      postalCode
    )}&key=${process.env.OPENCAGE_API_KEY}`
  );
  const geoData = await geoRes.json();
  const coords = geoData.results?.[0]?.geometry;
  if (!coords) return c.json({ error: "Invalid postal code" }, 404);

  const { lat, lng } = coords;

  // Step 2: Query Postgres for nearby happy hours
  const query = `
    SELECT * FROM happy_hours
    WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, 2000)
    AND CURRENT_TIME BETWEEN start_time AND end_time;
  `;

  const result = await pool.query(query, [lng, lat]);
  return c.json(result.rows);
});

serve(app, (info) => {
  console.log(`🚀 Hono backend running at http://localhost:${info.port}`);
});
