import { createServer } from 'http';
import { URL } from 'url';
import { pool } from "./db";
import "dotenv/config";

const server = createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  const url = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = url.pathname;
  
  try {
    if (pathname === '/api/health' && req.method === 'GET') {
      try {
        const result = await pool.query("SELECT NOW()");
        const responseData = JSON.stringify({ 
          status: "ok", 
          db: "connected", 
          time: result.rows[0].now 
        });
        
        res.writeHead(200);
        res.end(responseData);
      } catch (error) {
        const responseData = JSON.stringify({ 
          status: "error", 
          message: error instanceof Error ? error.message : "Unknown error" 
        });
        
        res.writeHead(500);
        res.end(responseData);
      }
      return;
    }
    
    if (pathname === '/api/search' && req.method === 'GET') {
      const postalCode = url.searchParams.get('postalCode');
      console.log("Search request for postal code:", postalCode);
      
      if (!postalCode) {
        const responseData = JSON.stringify({ error: "Missing postalCode" });
        res.writeHead(400);
        res.end(responseData);
        return;
      }

      try {
        // Step 1: Geocode postal code using OpenCage
        console.log("Geocoding postal code:", postalCode);
        const geoRes = await fetch(
          `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
            postalCode
          )}&key=${process.env.OPENCAGE_API_KEY}`
        );
        const geoData = await geoRes.json();
        console.log("Geocoding response:", geoData);
        
        // Check if API key is valid
        if (geoData.status && geoData.status.code === 401) {
          console.log("Invalid API key, using test coordinates for demo");
          // Use test coordinates for New York area for demo purposes
          const testCoords = { lat: 40.748, lng: -73.986 };
          const result = await pool.query(`
            SELECT * FROM happy_hours
            WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, 2000)
            AND CURRENT_TIME BETWEEN start_time AND end_time;
          `, [testCoords.lng, testCoords.lat]);
          
          const responseData = JSON.stringify({
            message: "Demo mode: API key needed for real geocoding",
            postalCode,
            testLocation: "New York area",
            results: result.rows
          });
          
          res.writeHead(200);
          res.end(responseData);
          return;
        }
        
        // Find the best result - prioritize US results for postal codes like 10001
        let bestResult = geoData.results?.[0];
        if (geoData.results && geoData.results.length > 1) {
          // Look for US result if multiple results exist
          const usResult = geoData.results.find((result: any) => 
            result.components?.country_code === 'us'
          );
          if (usResult) {
            bestResult = usResult;
            console.log("Found US result, using:", bestResult.formatted);
          }
        }
        
        const coords = bestResult?.geometry;
        if (!coords) {
          const responseData = JSON.stringify({ error: "Invalid postal code" });
          res.writeHead(404);
          res.end(responseData);
          return;
        }

        const { lat, lng } = coords;
        console.log("Coordinates:", { lat, lng });

        // Step 2: Query Postgres for nearby happy hours
        const query = `
          SELECT * FROM happy_hours
          WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, 2000)
          AND CURRENT_TIME BETWEEN start_time AND end_time;
        `;

        console.log("Executing database query with coordinates:", [lng, lat]);
        const result = await pool.query(query, [lng, lat]);
        console.log("Database result:", result.rows);
        
        // If no results found, provide helpful message
        if (result.rows.length === 0) {
          const responseData = JSON.stringify({
            message: `No happy hours found near ${postalCode}. Our sample data is in New York area (try 10001).`,
            postalCode,
            location: bestResult?.formatted || "Unknown location",
            results: []
          });
          
          res.writeHead(200);
          res.end(responseData);
          return;
        }
        
        const responseData = JSON.stringify({
          message: `Found ${result.rows.length} happy hour(s) near ${postalCode}`,
          postalCode,
          location: bestResult?.formatted || "Unknown location", 
          results: result.rows
        });
        
        res.writeHead(200);
        res.end(responseData);
        return;
      } catch (error) {
        console.error("Search error:", error);
        const responseData = JSON.stringify({ 
          error: "Internal server error", 
          details: error instanceof Error ? error.message : "Unknown error" 
        });
        
        res.writeHead(500);
        res.end(responseData);
        return;
      }
    }
    
    // 404 for unmatched routes
    const responseData = JSON.stringify({ error: "Not found" });
    res.writeHead(404);
    res.end(responseData);
    
  } catch (error) {
    console.error("Server error:", error);
    const responseData = JSON.stringify({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    });
    
    res.writeHead(500);
    res.end(responseData);
  }
});

const port = 3000;
server.listen(port, () => {
  console.log(`🚀 Native HTTP backend running at http://localhost:${port}`);
});
