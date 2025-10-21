import { createServer } from 'http';
import { URL } from 'url';
import { pool } from "./db";
import "dotenv/config";

// Google Places API integration
async function searchNearbyPlaces(lat: number, lng: number, radius: number = 2000) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error("Google Places API key not configured");
  }

  // Search for bars and restaurants
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=bar|restaurant&key=${apiKey}`;
  
  console.log("Fetching from Google Places API:", url.replace(apiKey, '[API_KEY]'));
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    throw new Error(`Google Places API error: ${data.status} - ${data.error_message || 'Unknown error'}`);
  }
  
  return data.results || [];
}

async function getPlaceDetails(placeId: string) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const fields = 'name,formatted_address,geometry,opening_hours,price_level,rating,reviews,types,website,formatted_phone_number';
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK') {
    console.warn(`Failed to get details for place ${placeId}: ${data.status}`);
    return null;
  }
  
  return data.result;
}

function hasHappyHourIndicators(place: any): boolean {
  // Check if place likely has happy hours based on:
  // 1. Type (bar, night_club, liquor_store should be prioritized)
  // 2. Reviews mentioning "happy hour"
  // 3. Name containing happy hour related terms
  
  const happyHourKeywords = ['happy hour', 'happy-hour', 'drink special', 'cocktail hour', 'wine hour'];
  const barTypes = ['bar', 'night_club', 'liquor_store'];
  
  // Check types
  const isBar = place.types?.some((type: string) => barTypes.includes(type));
  
  // Check name
  const nameHasHappyHour = happyHourKeywords.some(keyword => 
    place.name?.toLowerCase().includes(keyword)
  );
  
  // Check reviews for happy hour mentions
  const reviewsHaveHappyHour = place.reviews?.some((review: any) => 
    happyHourKeywords.some(keyword => 
      review.text?.toLowerCase().includes(keyword)
    )
  );
  
  // Prioritize bars, then places with happy hour mentions
  if (isBar) return true;
  if (nameHasHappyHour || reviewsHaveHappyHour) return true;
  
  return false;
}

async function searchRealHappyHours(postalCode: string) {
  try {
    // Step 1: Geocode postal code using OpenCage (reuse existing logic)
    console.log("Geocoding postal code for real search:", postalCode);
    const geoRes = await fetch(
      `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(
        postalCode
      )}&key=${process.env.OPENCAGE_API_KEY}`
    );
    const geoData = await geoRes.json();
    
    // Find the best result - prioritize US results
    let bestResult = geoData.results?.[0];
    if (geoData.results && geoData.results.length > 1) {
      const usResult = geoData.results.find((result: any) => 
        result.components?.country_code === 'us'
      );
      if (usResult) {
        bestResult = usResult;
      }
    }
    
    const coords = bestResult?.geometry;
    if (!coords) {
      return { error: "Invalid postal code", results: [] };
    }

    const { lat, lng } = coords;
    console.log("Searching real places near coordinates:", { lat, lng });

    // Step 2: Search Google Places for nearby bars and restaurants
    const places = await searchNearbyPlaces(lat, lng);
    console.log(`Found ${places.length} places from Google Places API`);
    
    // Step 3: Get detailed information and filter for likely happy hour spots
    const detailedPlaces = [];
    const maxPlaces = Math.min(places.length, 10); // Limit API calls
    
    for (let i = 0; i < maxPlaces; i++) {
      const place = places[i];
      try {
        const details = await getPlaceDetails(place.place_id);
        if (details) {
          // Add Google Places data with happy hour likelihood
          const enrichedPlace = {
            id: place.place_id,
            name: details.name,
            address: details.formatted_address,
            location: {
              lat: details.geometry?.location?.lat,
              lng: details.geometry?.location?.lng
            },
            rating: details.rating,
            price_level: details.price_level,
            types: details.types,
            opening_hours: details.opening_hours,
            website: details.website,
            phone: details.formatted_phone_number,
            likely_has_happy_hour: hasHappyHourIndicators(details),
            reviews_sample: details.reviews?.slice(0, 2), // Include sample reviews
            source: 'google_places'
          };
          
          detailedPlaces.push(enrichedPlace);
        }
      } catch (error) {
        console.warn(`Failed to get details for place ${place.name}:`, error);
      }
    }
    
    // Sort by happy hour likelihood, then by rating
    detailedPlaces.sort((a, b) => {
      if (a.likely_has_happy_hour && !b.likely_has_happy_hour) return -1;
      if (!a.likely_has_happy_hour && b.likely_has_happy_hour) return 1;
      return (b.rating || 0) - (a.rating || 0);
    });
    
    return {
      message: `Found ${detailedPlaces.length} places near ${postalCode} (${detailedPlaces.filter(p => p.likely_has_happy_hour).length} likely have happy hours)`,
      postalCode,
      location: bestResult?.formatted || "Unknown location",
      coordinates: { lat, lng },
      results: detailedPlaces,
      source: 'google_places_api'
    };
    
  } catch (error) {
    console.error("Google Places search error:", error);
    throw error;
  }
}

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
      const useReal = url.searchParams.get('real') === 'true';
      const ignoreTime = url.searchParams.get('ignoreTime') === 'true';
      console.log("Search request for postal code:", postalCode, "useReal:", useReal, "ignoreTime:", ignoreTime);
      
      if (!postalCode) {
        const responseData = JSON.stringify({ error: "Missing postalCode" });
        res.writeHead(400);
        res.end(responseData);
        return;
      }

      if (useReal) {
        // Use Google Places API for real data
        try {
          const realResults = await searchRealHappyHours(postalCode);
          const responseData = JSON.stringify(realResults);
          res.writeHead(200);
          res.end(responseData);
          return;
        } catch (error) {
          console.error("Real search error, falling back to sample data:", error);
          // Fall through to sample data search
        }
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
          SELECT *, CURRENT_TIME as current_time FROM happy_hours
          WHERE ST_DWithin(location, ST_MakePoint($1, $2)::geography, 2000);
        `;

        console.log("Executing database query with coordinates:", [lng, lat]);
        const result = await pool.query(query, [lng, lat]);
        console.log("Database result (all nearby, ignoring time):", result.rows);
        
        // Filter by time in JavaScript for better debugging (unless ignoreTime is true)
        let finalResults;
        if (ignoreTime) {
          finalResults = result.rows;
          console.log("Ignoring time filter, showing all nearby places");
        } else {
          const currentTime = new Date().toTimeString().substr(0, 5); // HH:MM format
          console.log("Current time:", currentTime);
          
          finalResults = result.rows.filter(row => {
            const startTime = row.start_time;
            const endTime = row.end_time;
            console.log(`Checking ${row.name}: ${startTime} <= ${currentTime} <= ${endTime}`);
            return currentTime >= startTime && currentTime <= endTime;
          });
        }
        
        console.log("Final results:", finalResults);
        
        // If no results found, provide helpful message
        if (finalResults.length === 0) {
          const currentTime = new Date().toTimeString().substr(0, 5);
          const responseData = JSON.stringify({
            message: ignoreTime 
              ? `No places found near ${postalCode}. Our sample data is in New York area (try 10001).`
              : `No active happy hours found near ${postalCode} right now. Found ${result.rows.length} places total. Current time: ${currentTime}. Try again during happy hour times or add ?ignoreTime=true to see all places!`,
            postalCode,
            location: bestResult?.formatted || "Unknown location",
            results: ignoreTime ? [] : result.rows, // Show all nearby places if time-based search fails
            debug: {
              currentTime,
              totalPlaces: result.rows.length,
              activePlaces: finalResults.length,
              ignoreTime
            }
          });
          
          res.writeHead(200);
          res.end(responseData);
          return;
        }
        
        const responseData = JSON.stringify({
          message: `Found ${finalResults.length} ${ignoreTime ? 'place(s)' : 'active happy hour(s)'} near ${postalCode}`,
          postalCode,
          location: bestResult?.formatted || "Unknown location", 
          results: finalResults
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
