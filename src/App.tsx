import { useState } from "react";

function App() {
  const [postalCode, setPostalCode] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [message, setMessage] = useState("");
  const [useRealData, setUseRealData] = useState(false);
  const [ignoreTime, setIgnoreTime] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!postalCode) return;

    setLoading(true);
    setMessage("");
    setResults([]);

    try {
      const searchUrl = `/api/search?postalCode=${encodeURIComponent(
        postalCode
      )}${useRealData ? "&real=true" : ""}${
        ignoreTime ? "&ignoreTime=true" : ""
      }`;
      console.log("Searching with:", {
        postalCode,
        useRealData,
        ignoreTime,
        url: searchUrl,
      });

      const res = await fetch(searchUrl);

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log("Search response:", data);
      console.log("First result details:", data.results?.[0]); // Log first result for debugging

      // Handle response based on data source
      if (data.message && data.results !== undefined) {
        setMessage(data.message);
        setResults(data.results);
      } else if (Array.isArray(data)) {
        // Handle normal response
        setMessage("");
        setResults(data);
      } else if (data.error) {
        setMessage(`Error: ${data.error}`);
        setResults([]);
      } else {
        setResults([]);
        setMessage("No results found");
      }
    } catch (error) {
      console.error("Search error:", error);
      setMessage("Error connecting to server");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center">
      <div className="p-6 max-w-2xl mx-auto absolute top-10 left-1/2 -translate-x-1/2">
        <h1 className="text-3xl font-bold mb-4 text-center">
          🍻 Happy Hour Finder
        </h1>

        <div className="mb-4">
          <input
            type="text"
            className="border p-2 w-full mb-2"
            placeholder="Enter a postal code (e.g., 10001 for NYC)"
            value={postalCode}
            onChange={(e) => setPostalCode(e.target.value)}
          />

          <div className="flex items-center gap-4 mb-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={useRealData}
                onChange={(e) => setUseRealData(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">
                Use real Google Places data{" "}
                {useRealData ? "🌐" : "📝 (Sample data)"}
              </span>
            </label>

            {!useRealData && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={ignoreTime}
                  onChange={(e) => setIgnoreTime(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm">
                  Show all places (ignore time) 🕐
                </span>
              </label>
            )}
          </div>

          <button
            onClick={handleSearch}
            disabled={loading}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {message && (
          <div className="mt-4 p-3 bg-blue-100 border border-blue-400 rounded">
            <p className="text-blue-800">{message}</p>
          </div>
        )}

        <ul className="mt-6 space-y-4">
          {results.map((place, index) => (
            <li key={place.id || index} className="border p-4 rounded shadow">
              <div className="flex justify-between items-start mb-2">
                <h2 className="text-lg font-semibold">{place.name}</h2>
                {place.likely_has_happy_hour && (
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                    🍸 Likely Happy Hour
                  </span>
                )}
                {place.rating && (
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                    ⭐ {place.rating}
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-2">
                📍 {place.address || "Address not available"}
              </p>

              {/* Sample data format */}
              {place.benefits && (
                <p className="text-sm text-gray-700 mb-1">
                  🍹 Benefits: {place.benefits.join(", ")}
                </p>
              )}
              {place.start_time && place.end_time && (
                <p className="text-sm text-gray-700 mb-1">
                  🕔 Hours: {place.start_time} - {place.end_time}
                </p>
              )}

              {/* Google Places data format */}
              {(place.source === "google_places" || place.source === "google_places_enhanced" || place.source === "google_places_enhanced_mining") && (
                <div className="text-sm text-gray-700">
                  {place.types && (
                    <p className="mb-1">
                      🏷️ Type: {place.types.slice(0, 3).join(", ")}
                    </p>
                  )}
                  {place.price_level && (
                    <p className="mb-1">
                      💰 Price: {"$".repeat(place.price_level)} (
                      {place.price_level}/4)
                    </p>
                  )}
                  {place.phone && <p className="mb-1">📞 {place.phone}</p>}
                  {place.website && (
                    <p className="mb-1">
                      🌐{" "}
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Website
                      </a>
                    </p>
                  )}
                  {place.opening_hours && (
                    <p className="mb-1">
                      {place.opening_hours.open_now
                        ? "🟢 Open now"
                        : "🔴 Closed"}
                    </p>
                  )}

                  {/* Happy Hour Analysis */}
                  {(place.happy_hour_confidence !== undefined || place.review_mining || place.likely_has_happy_hour) && (
                    <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded">
                      <p className="font-medium text-amber-800 mb-1">
                        🍸 Happy Hour Analysis {place.happy_hour_confidence !== undefined ? `(${place.happy_hour_confidence}% confidence)` : ''}
                      </p>
                      
                      {/* Debug info - remove later */}
                      <div className="text-xs text-gray-500 mb-2">
                        Debug: confidence={place.happy_hour_confidence}, likely={place.likely_has_happy_hour ? 'yes' : 'no'}, 
                        mining={place.review_mining ? 'yes' : 'no'}
                      </div>
                      
                      {/* Review Mining Summary */}
                      {place.review_mining?.summary && (
                        <div className="mt-2">
                          {place.review_mining.summary.times && place.review_mining.summary.times.length > 0 && (
                            <p className="text-sm text-amber-700 mb-1">
                              🕐 Times: {place.review_mining.summary.times.map((t: any) => `${t.start}-${t.end}`).join(", ")}
                            </p>
                          )}
                          
                          {place.review_mining.summary.deals && place.review_mining.summary.deals.length > 0 && (
                            <p className="text-sm text-amber-700 mb-1">
                              💸 Deals: {place.review_mining.summary.deals.join(", ")}
                            </p>
                          )}
                          
                          {place.review_mining.summary.days && place.review_mining.summary.days.length > 0 && (
                            <p className="text-sm text-amber-700 mb-1">
                              📅 Days: {place.review_mining.summary.days.join(", ")}
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Show message if no specific details found */}
                      {(!place.review_mining?.summary?.times || place.review_mining.summary.times.length === 0) &&
                       (!place.review_mining?.summary?.deals || place.review_mining.summary.deals.length === 0) && (
                        <p className="text-sm text-amber-600">
                          {place.likely_has_happy_hour ? 'Likely has happy hour based on venue type and characteristics' : 'No specific happy hour details extracted from reviews'}
                        </p>
                      )}
                      
                      {/* Review Evidence */}
                      {place.review_mining?.happy_hour_mentions > 0 && (
                        <p className="text-xs text-amber-600 mt-1">
                          📝 Found evidence in {place.review_mining.happy_hour_mentions} review(s) out of {place.review_mining.total_reviews} total
                        </p>
                      )}
                      
                      {/* Sample relevant reviews */}
                      {place.review_mining?.sample_reviews && place.review_mining.sample_reviews.length > 0 && (
                        <details className="mt-2">
                          <summary className="text-xs text-amber-600 cursor-pointer">
                            View sample reviews mentioning happy hour
                          </summary>
                          <div className="mt-1 text-xs text-gray-600 max-h-32 overflow-y-auto">
                            {place.review_mining.sample_reviews.map((review: any, idx: number) => (
                              <div key={idx} className="mb-2 p-1 bg-white rounded border">
                                <div className="font-medium">{review.author} ({review.rating}/5)</div>
                                <div className="italic text-gray-500 text-xs mb-1">
                                  {review.happyHourInfo?.description || review.text.substring(0, 100) + "..."}
                                </div>
                                {review.happyHourInfo && (
                                  <div className="text-xs">
                                    {review.happyHourInfo.times && review.happyHourInfo.times.length > 0 && (
                                      <span className="inline-block mr-2 bg-blue-100 px-1 rounded">
                                        {review.happyHourInfo.times.map((t: any) => `${t.start}-${t.end}`).join(", ")}
                                      </span>
                                    )}
                                    {review.happyHourInfo.deals && review.happyHourInfo.deals.length > 0 && (
                                      <span className="inline-block mr-2 bg-green-100 px-1 rounded">
                                        {review.happyHourInfo.deals.slice(0, 2).join(", ")}
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        {results.length === 0 && !message && (
          <p className="mt-6 text-gray-500 text-center">
            Enter a postal code and click search to find happy hours nearby!
          </p>
        )}
      </div>
    </div>
  );
}

export default App;
