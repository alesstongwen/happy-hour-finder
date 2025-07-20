import { useState } from "react";
import "./App.css";

function App() {
  const [postalCode, setPostalCode] = useState("");
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!postalCode) return;

    const res = await fetch(
      `/api/search?postalCode=${encodeURIComponent(postalCode)}`
    );
    const data = await res.json();
    setResults(data);
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">🍻 Happy Hour Finder</h1>
      <input
        type="text"
        className="border p-2 w-full mb-2"
        placeholder="Enter a postal code (e.g., V6B 3H7)"
        value={postalCode}
        onChange={(e) => setPostalCode(e.target.value)}
      />
      <button
        onClick={handleSearch}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Search
      </button>

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
    </div>
  );
}

export default App;
