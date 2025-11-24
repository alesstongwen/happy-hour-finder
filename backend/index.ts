import { createServer } from 'http';
import { URL } from 'url';
import { pool } from "./db";
import "dotenv/config";

// Enhanced Review Mining Functions
interface HappyHourInfo {
  timeRange?: string;
  times?: Array<{start: string, end: string}>;
  deals?: string[];
  days?: string[];
  description?: string;
  confidence?: number;
}

interface MinedReview {
  text: string;
  rating: number;
  author: string;
  time: string;
  happyHourInfo?: HappyHourInfo;
}

function extractTimeRanges(text: string): Array<{start: string, end: string}> {
  const timePatterns = [
    // Pattern: 3pm-6pm, 3:00-6:00, 3-6pm, etc.
    /(\d{1,2}(?::\d{2})?)\s*(?:am|pm)?\s*[-–—]\s*(\d{1,2}(?::\d{2})?)\s*(am|pm)/gi,
    // Pattern: 3-6, 3:00-6:00 (no am/pm)
    /(\d{1,2}(?::\d{2})?)\s*[-–—]\s*(\d{1,2}(?::\d{2})?)/gi,
    // Pattern: from 3pm to 6pm
    /from\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s+to\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/gi,
    // Pattern: between 3pm and 6pm
    /between\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s+and\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/gi,
    // Pattern: 3pm until 6pm
    /(\d{1,2}(?::\d{2})?)\s*(am|pm)?\s+until\s+(\d{1,2}(?::\d{2})?)\s*(am|pm)/gi
  ];

  const times: Array<{start: string, end: string}> = [];

  for (const pattern of timePatterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      try {
        let start = match[1];
        let end = match[2];
        let modifier = match[3] || match[4]; // am/pm

        // Handle different pattern groups
        if (match.length > 4) {
          // Patterns with "from...to" or "between...and" 
          start = match[1];
          end = match[3];
          modifier = match[4] || match[2];
        }

        // Normalize times
        start = normalizeTime(start, modifier);
        end = normalizeTime(end, modifier);

        if (start && end) {
          times.push({ start, end });
        }
      } catch (error) {
        console.warn('Failed to parse time from match:', match, error);
      }
    }
  }

  return times;
}

function normalizeTime(time: string, modifier?: string): string {
  if (!time) return '';
  
  // Remove any non-numeric/colon characters
  time = time.replace(/[^\d:]/g, '');
  
  // Add :00 if just hour
  if (!time.includes(':')) {
    time = time + ':00';
  }
  
  // Convert to 24-hour format
  let [hours, minutes] = time.split(':').map(Number);
  
  if (modifier?.toLowerCase() === 'pm' && hours !== 12) {
    hours += 12;
  } else if (modifier?.toLowerCase() === 'am' && hours === 12) {
    hours = 0;
  }
  
  // Format as HH:MM
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

function extractDeals(text: string): string[] {
  const dealPatterns = [
    // Dollar amounts
    /\$\d+(?:\.\d{2})?\s+(?:drinks?|beers?|cocktails?|wine|shots?)/gi,
    // Percentage discounts
    /\d+%\s+off/gi,
    // Buy one get one
    /(?:bogo|buy\s+one\s+get\s+one|b1g1)/gi,
    // Half price/off
    /(?:half\s+price|50%\s+off|half\s+off)/gi,
    // Specific drink deals
    /\$\d+\s+(?:margaritas?|mojitos?|martinis?|sangria|draft|drafts)/gi,
    // Food deals during happy hour
    /(?:appetizers?|apps|food)\s+(?:\$\d+|half\s+price|50%\s+off)/gi,
    // Two for one
    /(?:2\s+for\s+1|two\s+for\s+one)/gi
  ];

  const deals: string[] = [];
  
  for (const pattern of dealPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      deals.push(...matches.map(deal => deal.trim()));
    }
  }

  return [...new Set(deals)]; // Remove duplicates
}

function extractDays(text: string): string[] {
  const dayPatterns = [
    /monday|tuesday|wednesday|thursday|friday|saturday|sunday/gi,
    /(?:mon|tue|wed|thu|fri|sat|sun)(?:day)?/gi,
    /weekdays?/gi,
    /weekends?/gi,
    /daily/gi,
    /every\s+day/gi
  ];

  const days: string[] = [];
  
  for (const pattern of dayPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      days.push(...matches.map(day => day.toLowerCase()));
    }
  }

  return [...new Set(days)]; // Remove duplicates
}

function calculateHappyHourConfidence(text: string, happyHourInfo: HappyHourInfo): number {
  let confidence = 0;
  
  const lowerText = text.toLowerCase();
  
  // Base confidence for mentioning happy hour
  if (lowerText.includes('happy hour')) {
    confidence += 30;
  } else if (lowerText.includes('drink special') || lowerText.includes('cocktail hour')) {
    confidence += 20;
  }
  
  // Time information adds confidence
  if (happyHourInfo.times && happyHourInfo.times.length > 0) {
    confidence += 25;
  }
  
  // Deal information adds confidence
  if (happyHourInfo.deals && happyHourInfo.deals.length > 0) {
    confidence += 20;
  }
  
  // Day information adds confidence
  if (happyHourInfo.days && happyHourInfo.days.length > 0) {
    confidence += 15;
  }
  
  // Recent/specific mentions add confidence
  if (lowerText.includes('$') && (lowerText.includes('drink') || lowerText.includes('beer'))) {
    confidence += 10;
  }
  
  return Math.min(confidence, 100); // Cap at 100%
}

function mineReviewForHappyHour(reviewText: string): HappyHourInfo | null {
  const lowerText = reviewText.toLowerCase();
  
  // Check if review mentions happy hour related terms
  const happyHourKeywords = [
    'happy hour', 'happy-hour', 'drink special', 'cocktail hour', 
    'wine hour', 'discounted drinks', 'cheap drinks', '2 for 1',
    'half price', 'drink deal', 'early bird'
  ];
  
  const hasHappyHourMention = happyHourKeywords.some(keyword => 
    lowerText.includes(keyword)
  );
  
  if (!hasHappyHourMention) {
    return null; // No happy hour information found
  }
  
  // Extract components
  const times = extractTimeRanges(reviewText);
  const deals = extractDeals(reviewText);
  const days = extractDays(reviewText);
  
  const happyHourInfo: HappyHourInfo = {
    times,
    deals,
    days,
    description: reviewText.length > 200 ? reviewText.substring(0, 200) + '...' : reviewText
  };
  
  // Calculate confidence
  happyHourInfo.confidence = calculateHappyHourConfidence(reviewText, happyHourInfo);
  
  // Only return if we have meaningful information
  if (times.length > 0 || deals.length > 0 || days.length > 0) {
    return happyHourInfo;
  }
  
  return null;
}

function mineAllReviews(reviews: any[]): {
  minedReviews: MinedReview[];
  happyHourSummary: HappyHourInfo;
} {
  const minedReviews: MinedReview[] = [];
  const allHappyHourInfo: HappyHourInfo[] = [];
  
  for (const review of reviews || []) {
    const happyHourInfo = mineReviewForHappyHour(review.text || '');
    
    const minedReview: MinedReview = {
      text: review.text || '',
      rating: review.rating || 0,
      author: review.author_name || 'Anonymous',
      time: review.relative_time_description || 'Unknown',
      happyHourInfo: happyHourInfo || undefined
    };
    
    minedReviews.push(minedReview);
    
    if (happyHourInfo) {
      allHappyHourInfo.push(happyHourInfo);
    }
  }
  
  // Aggregate all happy hour information
  const summary: HappyHourInfo = aggregateHappyHourInfo(allHappyHourInfo);
  
  return {
    minedReviews: minedReviews.filter(r => r.happyHourInfo), // Only return reviews with HH info
    happyHourSummary: summary
  };
}

function aggregateHappyHourInfo(happyHourInfos: HappyHourInfo[]): HappyHourInfo {
  if (happyHourInfos.length === 0) {
    return {};
  }
  
  // Combine all times
  const allTimes: Array<{start: string, end: string}> = [];
  const allDeals: string[] = [];
  const allDays: string[] = [];
  let totalConfidence = 0;
  
  for (const info of happyHourInfos) {
    if (info.times) {
      allTimes.push(...info.times);
    }
    if (info.deals) {
      allDeals.push(...info.deals);
    }
    if (info.days) {
      allDays.push(...info.days);
    }
    totalConfidence += info.confidence || 0;
  }
  
  // Remove duplicates and calculate averages
  const uniqueTimes = [...new Set(allTimes.map(t => `${t.start}-${t.end}`))]
    .map(timeStr => {
      const [start, end] = timeStr.split('-');
      return { start, end };
    });
  
  const uniqueDeals = [...new Set(allDeals)];
  const uniqueDays = [...new Set(allDays)];
  const avgConfidence = happyHourInfos.length > 0 ? totalConfidence / happyHourInfos.length : 0;
  
  return {
    times: uniqueTimes,
    deals: uniqueDeals,
    days: uniqueDays,
    confidence: Math.round(avgConfidence),
    description: `Aggregated from ${happyHourInfos.length} review(s) mentioning happy hour`
  };
}

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
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=${fields}&reviews_sort=newest&key=${apiKey}`;
  
  const response = await fetch(url);
  const data = await response.json();
  
  if (data.status !== 'OK') {
    console.warn(`Failed to get details for place ${placeId}: ${data.status}`);
    return null;
  }
  
  return data.result;
}

function hasHappyHourIndicators(place: any): { hasHappyHour: boolean; confidence: number; minedData?: HappyHourInfo } {
  // Enhanced happy hour detection using review mining
  
  const happyHourKeywords = ['happy hour', 'happy-hour', 'drink special', 'cocktail hour', 'wine hour'];
  const barTypes = ['bar', 'night_club', 'liquor_store'];
  
  // Check types
  const isBar = place.types?.some((type: string) => barTypes.includes(type));
  
  // Check name
  const nameHasHappyHour = happyHourKeywords.some(keyword => 
    place.name?.toLowerCase().includes(keyword)
  );
  
  // Enhanced review mining
  const reviewMining = mineAllReviews(place.reviews || []);
  const hasReviewEvidence = reviewMining.minedReviews.length > 0;
  const reviewConfidence = reviewMining.happyHourSummary.confidence || 0;
  
  // Calculate overall confidence
  let confidence = 0;
  if (isBar) confidence += 30;
  if (nameHasHappyHour) confidence += 40;
  if (hasReviewEvidence) confidence += reviewConfidence;
  
  const hasHappyHour = confidence > 20; // Threshold for likely happy hour
  
  return {
    hasHappyHour,
    confidence: Math.min(confidence, 100),
    minedData: hasReviewEvidence ? reviewMining.happyHourSummary : undefined
  };
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
          console.log(`Mining reviews for ${details.name}...`);
          
          // Enhanced happy hour detection with review mining
          const happyHourAnalysis = hasHappyHourIndicators(details);
          const reviewMining = mineAllReviews(details.reviews || []);
          
          console.log(`${details.name}: Happy hour confidence ${happyHourAnalysis.confidence}%, found ${reviewMining.minedReviews.length} relevant reviews`);
          
          // Add Google Places data with comprehensive happy hour information
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
            
            // Enhanced happy hour data
            likely_has_happy_hour: happyHourAnalysis.hasHappyHour,
            happy_hour_confidence: happyHourAnalysis.confidence,
            happy_hour_details: happyHourAnalysis.minedData,
            
            // Review mining results
            review_mining: {
              total_reviews: details.reviews?.length || 0,
              happy_hour_mentions: reviewMining.minedReviews.length,
              summary: reviewMining.happyHourSummary,
              sample_reviews: reviewMining.minedReviews.slice(0, 3) // Top 3 relevant reviews
            },
            
            source: 'google_places_enhanced'
          };
          
          detailedPlaces.push(enrichedPlace);
        }
      } catch (error) {
        console.warn(`Failed to get details for place ${place.name}:`, error);
      }
    }
    
    // Sort by happy hour confidence, then by rating
    detailedPlaces.sort((a, b) => {
      // First sort by happy hour confidence
      const confidenceDiff = (b.happy_hour_confidence || 0) - (a.happy_hour_confidence || 0);
      if (confidenceDiff !== 0) return confidenceDiff;
      
      // Then by rating
      return (b.rating || 0) - (a.rating || 0);
    });
    
    const highConfidencePlaces = detailedPlaces.filter(p => (p.happy_hour_confidence || 0) >= 50);
    const totalHappyHourMentions = detailedPlaces.reduce((sum, place) => 
      sum + (place.review_mining?.happy_hour_mentions || 0), 0);
    
    return {
      message: `Found ${detailedPlaces.length} places near ${postalCode}`,
      analysis: {
        total_places: detailedPlaces.length,
        high_confidence_happy_hour: highConfidencePlaces.length,
        total_happy_hour_mentions: totalHappyHourMentions,
        places_with_review_evidence: detailedPlaces.filter(p => 
          (p.review_mining?.happy_hour_mentions || 0) > 0).length
      },
      postalCode,
      location: bestResult?.formatted || "Unknown location",
      coordinates: { lat, lng },
      results: detailedPlaces,
      source: 'google_places_enhanced_mining'
    };
    
  } catch (error) {
    console.error("Google Places search error:", error);
    throw error;
  }
}

const server = createServer(async (req, res) => {
  // Set CORS headers - allow both potential frontend ports
  const allowedOrigins = ['http://localhost:5173', 'http://localhost:5174'];
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    // Default to 5173 if no origin header
    res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
  }
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
    
    
    if (pathname === '/api/place-analysis' && req.method === 'GET') {
      const placeId = url.searchParams.get('placeId');
      console.log("Place analysis request for:", placeId);
      
      if (!placeId) {
        const responseData = JSON.stringify({ error: "Missing placeId parameter" });
        res.writeHead(400);
        res.end(responseData);
        return;
      }

      try {
        const details = await getPlaceDetails(placeId);
        if (!details) {
          const responseData = JSON.stringify({ error: "Place not found" });
          res.writeHead(404);
          res.end(responseData);
          return;
        }

        console.log(`Analyzing place: ${details.name}`);
        
        // Perform comprehensive happy hour analysis
        const happyHourAnalysis = hasHappyHourIndicators(details);
        const reviewMining = mineAllReviews(details.reviews || []);
        
        const analysis = {
          place: {
            id: placeId,
            name: details.name,
            address: details.formatted_address,
            rating: details.rating,
            price_level: details.price_level,
            types: details.types,
            phone: details.formatted_phone_number,
            website: details.website,
            opening_hours: details.opening_hours
          },
          happy_hour_analysis: {
            confidence: happyHourAnalysis.confidence,
            has_happy_hour: happyHourAnalysis.hasHappyHour,
            detected_details: happyHourAnalysis.minedData,
            evidence_summary: {
              total_reviews: details.reviews?.length || 0,
              relevant_reviews: reviewMining.minedReviews.length,
              times_mentioned: reviewMining.happyHourSummary.times?.length || 0,
              deals_mentioned: reviewMining.happyHourSummary.deals?.length || 0,
              days_mentioned: reviewMining.happyHourSummary.days?.length || 0
            }
          },
          review_mining: {
            summary: reviewMining.happyHourSummary,
            relevant_reviews: reviewMining.minedReviews,
            all_reviews: details.reviews?.map((r: any) => ({
              text: r.text,
              rating: r.rating,
              author: r.author_name,
              time: r.relative_time_description
            })) || []
          }
        };

        const responseData = JSON.stringify(analysis);
        res.writeHead(200);
        res.end(responseData);
        return;
      } catch (error) {
        console.error("Place analysis error:", error);
        const responseData = JSON.stringify({ 
          error: "Failed to analyze place", 
          details: error instanceof Error ? error.message : "Unknown error" 
        });
        
        res.writeHead(500);
        res.end(responseData);
        return;
      }
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
