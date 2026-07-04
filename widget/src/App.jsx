import { useCallback, useEffect, useMemo, useState } from "react";
import FilterBar from "./components/FilterBar.jsx";
import MapView from "./components/MapView.jsx";
import FeaturedCard from "./components/FeaturedCard.jsx";
import VenueCard from "./components/VenueCard.jsx";

const EMPTY_FILTERS = { q: "", fish: [], types: [], takeout: false, ayce: false };

export function venueSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function milesBetween(a, b) {
  const R = 3958.8; // earth radius, miles
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState("name");
  const [userLoc, setUserLoc] = useState(null);
  const [locNote, setLocNote] = useState(null);
  const [focus, setFocus] = useState(null); // { name, source: "map" | "list", ts }

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/fish_fry.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Data fetch failed with status ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  // Embedded in a WordPress iframe: report our height so the parent page can
  // size the frame and the widget never scrolls-within-a-scroll.
  useEffect(() => {
    if (window.parent === window) return;
    const post = () =>
      window.parent.postMessage(
        { type: "wpr-fish-fry:height", height: document.documentElement.scrollHeight },
        "*"
      );
    const observer = new ResizeObserver(post);
    observer.observe(document.documentElement);
    post();
    return () => observer.disconnect();
  }, []);

  const venues = data ? data.venues : [];

  const filtered = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return venues.filter(
      (v) =>
        (!q || `${v.venue_name} ${v.city}`.toLowerCase().includes(q)) &&
        (filters.fish.length === 0 || filters.fish.some((f) => v.fish.includes(f))) &&
        (filters.types.length === 0 || filters.types.includes(v.venue_type)) &&
        (!filters.takeout || v.takeout) &&
        (!filters.ayce || v.all_you_can_eat)
    );
  }, [venues, filters]);

  const miles = useMemo(() => {
    if (!userLoc) return {};
    return Object.fromEntries(
      venues.map((v) => [v.venue_name, milesBetween(userLoc, v)])
    );
  }, [venues, userLoc]);

  const sortByDistance = () => {
    if (!("geolocation" in navigator)) {
      setLocNote("This browser doesn't share location — keeping A–Z order.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setSort("distance");
        setLocNote(null);
      },
      () => setLocNote("Location unavailable — keeping A–Z order."),
      { maximumAge: 300000, timeout: 10000 }
    );
  };

  const sortByName = () => {
    setSort("name");
    setLocNote(null);
  };

  const focusVenue = useCallback((name, source) => {
    setFocus({ name, source, ts: Date.now() });
  }, []);

  const onMarkerClick = useCallback(
    (name) => focusVenue(name, "map"),
    [focusVenue]
  );
  const onShowMap = useCallback(
    (name) => focusVenue(name, "list"),
    [focusVenue]
  );

  useEffect(() => {
    if (!focus || focus.source !== "map") return;
    const el = document.getElementById(`venue-${venueSlug(focus.name)}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focus]);

  // The featured slot is paid placement: pinned above the list, unaffected by
  // filters, and excluded from the list so it never renders twice.
  const featured = venues.find((v) => v.featured_this_week);
  const listVenues = useMemo(() => {
    const rest = filtered.filter((v) => v !== featured);
    if (sort === "distance" && userLoc) {
      return [...rest].sort(
        (a, b) => miles[a.venue_name] - miles[b.venue_name]
      );
    }
    return rest;
  }, [filtered, featured, sort, userLoc, miles]);

  if (error) {
    return (
      <div className="ff-app">
        <p className="ff-error">
          The fish fry data didn&rsquo;t load ({error}). Refresh the page — if it
          keeps happening, the newsroom knows where to find the build logs.
        </p>
      </div>
    );
  }

  return (
    <div className="ff-app">
      <header className="ff-header">
        <img
          className="ff-badge"
          src={`${import.meta.env.BASE_URL}brand/wpr-typewriter-192.png`}
          alt="Wausau Pilot & Review"
          width="72"
          height="72"
        />
        <h1>Friday Fish Fry Finder</h1>
        <p className="ff-tagline">
          Every fish fry in Marathon County — the prices, the perch, the potato
          pancakes.
        </p>
      </header>

      <FilterBar
        venues={venues}
        filters={filters}
        setFilters={setFilters}
        sort={sort}
        onSortName={sortByName}
        onSortDistance={sortByDistance}
        locNote={locNote}
      />
      <MapView venues={filtered} focus={focus} onMarkerClick={onMarkerClick} />

      {featured && (
        <FeaturedCard
          venue={featured}
          onShowMap={onShowMap}
          distance={miles[featured.venue_name]}
          selected={focus?.name === featured.venue_name}
        />
      )}

      <section className="ff-list" aria-label="Fish fry listings">
        {listVenues.map((v) => (
          <VenueCard
            key={v.venue_name}
            venue={v}
            onShowMap={onShowMap}
            distance={miles[v.venue_name]}
            selected={focus?.name === v.venue_name}
          />
        ))}
        {data && listVenues.length === 0 && (
          <p className="ff-empty">
            No fish fries match those filters. Loosen up — it&rsquo;s Friday.
          </p>
        )}
      </section>

      <footer className="ff-footer">
        <div className="ff-footer-brand">
          <img
            src={`${import.meta.env.BASE_URL}brand/wpr-typewriter-192.png`}
            alt=""
          />
          <a
            href="https://wausaupilotandreview.com"
            target="_blank"
            rel="noreferrer"
          >
            A Wausau Pilot &amp; Review reader guide
          </a>
        </div>
        Curated by the Wausau Pilot &amp; Review newsroom. Listings marked
        &ldquo;Sponsor&rdquo; are paid placements. Updated hourly.
        {data && (
          <span className="ff-updated">
            {" "}
            Last built {new Date(data.generated_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            .
          </span>
        )}
        <p className="ff-advertise">
          Run a fish fry?{" "}
          <a
            href="https://wausaupilotandreview.com/sponsorship-and-advertising/"
            target="_blank"
            rel="noreferrer"
          >
            Advertise with the Pilot &amp; Review
          </a>{" "}
          to add photos, your menu, and the weekly featured slot.
        </p>
      </footer>
    </div>
  );
}
