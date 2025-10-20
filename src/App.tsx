import { useState } from "react";
import "./App.css";

function App() {
  const [postalCode, setPostalCode] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const handleSearch = async () => {
    if (!postalCode) return;

    try {
      const res = await fetch(
        `/api/search?postalCode=${encodeURIComponent(postalCode)}`
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      // Handle demo mode response
      if (data.message && data.results) {
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
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">🍻 Happy Hour Finder</h1>
      <input
        type="text"
        className="border p-2 w-full mb-2"
        placeholder="Enter a postal code (try any code for demo)"
        value={postalCode}
        onChange={(e) => setPostalCode(e.target.value)}
      />
      <button
        onClick={handleSearch}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Search
      </button>

      {message && (
        <div className="mt-4 p-3 bg-blue-100 border border-blue-400 rounded">
          <p className="text-blue-800">{message}</p>
        </div>
      )}

      <ul className="mt-6 space-y-4">
        {results.map((place) => (
          <li key={place.id} className="border p-4 rounded shadow">
            <h2 className="text-lg font-semibold">{place.name}</h2>
            <p className="text-sm text-gray-700">
              🍹 Benefits: {place.benefits.join(", ")} <br />
              🕔 Hours: {place.start_time} - {place.end_time}
            </p>
          </li>
        ))}
      </ul>

      {results.length === 0 && !message && (
        <p className="mt-6 text-gray-500 text-center">
          Enter a postal code and click search to find happy hours nearby!
        </p>
      )}
    </div>
  );
}

export default App;
