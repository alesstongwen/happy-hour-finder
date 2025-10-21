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
              {place.source === "google_places" && (
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
