import { useState } from "react";
import { MapPin } from "lucide-react";
import { Button } from "../components/ui.jsx";

// Nearby restaurant search (location input + "Use My Location" from
// local-latest). Xlife has no restaurant data API, so instead of showing
// made-up restaurants, ratings or distances it hands the search to Apple Maps /
// Google Maps, which show real places near the chosen location.
export function NearbyFinder({ cuisine }) {
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);

  async function useMyLocation() {
    setError("");
    setLocating(true);
    try {
      const { Geolocation } = await import("@capacitor/geolocation");
      const permission = await Geolocation.requestPermissions().catch(() => ({ location: "granted" }));
      if (permission.location === "denied") {
        setError("Location permission denied. Enable it for Xlife in iPhone Settings.");
        return;
      }
      const position = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 10000 });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      setLocation("");
    } catch {
      setError("Could not get your location. Check Location permission in Settings, or type a place instead.");
    } finally {
      setLocating(false);
    }
  }

  const query = `${cuisine ? `${cuisine} ` : ""}restaurants`;
  const where = coords ? null : location.trim();
  const ready = Boolean(coords || where);
  const appleUrl = coords
    ? `https://maps.apple.com/?q=${encodeURIComponent(query)}&sll=${coords.lat},${coords.lng}`
    : `https://maps.apple.com/?q=${encodeURIComponent(`${query} near ${where}`)}`;
  const googleUrl = coords
    ? `https://www.google.com/maps/search/${encodeURIComponent(query)}/@${coords.lat},${coords.lng},15z`
    : `https://www.google.com/maps/search/${encodeURIComponent(`${query} near ${where}`)}`;

  return (
    <div className="mt-4 rounded-3xl bg-white p-3 dark:bg-zinc-900" data-testid="nearby-finder">
      <p className="flex items-center gap-2 text-sm font-bold"><MapPin className="h-4 w-4" />Find nearby restaurants</p>
      <div className="mt-2 grid gap-2">
        <input
          className="field mb-0"
          placeholder="Enter city, area, or address"
          aria-label="Nearby location"
          value={location}
          onChange={(e) => {
            setLocation(e.target.value);
            setCoords(null);
            setError("");
          }}
        />
        <Button variant="secondary" onClick={useMyLocation} disabled={locating} className="rounded-2xl py-3 text-sm">
          {locating ? "Locating…" : "Use My Location"}
        </Button>
      </div>
      {coords && (
        <p className="mt-2 rounded-2xl bg-[hsl(160_50%_45%)]/10 p-3 text-sm font-bold text-[hsl(160_50%_45%)]">Using current location</p>
      )}
      {error && (
        <p className="mt-2 rounded-2xl bg-rose-50 p-3 text-sm font-semibold text-rose-600 dark:bg-rose-950/30 dark:text-rose-200" role="alert">{error}</p>
      )}
      {ready ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <a href={appleUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-[hsl(24_80%_58%)] px-3 py-3 text-center text-sm font-bold text-white">Open in Apple Maps</a>
          <a href={googleUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-zinc-100 px-3 py-3 text-center text-sm font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">Google Maps</a>
        </div>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">Pick a cuisine above, then enter a place or use your location. Results open in Maps (real listings); save the ones you like here.</p>
      )}
    </div>
  );
}
