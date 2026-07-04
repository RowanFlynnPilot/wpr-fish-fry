import { useEffect, useMemo, useState } from "react";
import FilterBar from "./components/FilterBar.jsx";
import MapView from "./components/MapView.jsx";
import FeaturedCard from "./components/FeaturedCard.jsx";
import VenueCard from "./components/VenueCard.jsx";

const EMPTY_FILTERS = { fish: [], types: [], takeout: false, ayce: false };

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/fish_fry.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Data fetch failed with status ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const venues = data ? data.venues : [];

  const filtered = useMemo(
    () =>
      venues.filter(
        (v) =>
          (filters.fish.length === 0 || filters.fish.some((f) => v.fish.includes(f))) &&
          (filters.types.length === 0 || filters.types.includes(v.venue_type)) &&
          (!filters.takeout || v.takeout) &&
          (!filters.ayce || v.all_you_can_eat)
      ),
    [venues, filters]
  );

  // The featured slot is paid placement: pinned above the list, unaffected by
  // filters, and excluded from the list so it never renders twice.
  const featured = venues.find((v) => v.featured_this_week);
  const listVenues = filtered.filter((v) => v !== featured);

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
        <h1>Friday Fish Fry Finder</h1>
        <p className="ff-tagline">
          Every fish fry in Marathon County — the prices, the perch, the potato
          pancakes.
        </p>
      </header>

      <FilterBar venues={venues} filters={filters} setFilters={setFilters} />
      <MapView venues={filtered} />

      {featured && <FeaturedCard venue={featured} />}

      <section className="ff-list" aria-label="Fish fry listings">
        {listVenues.map((v) => (
          <VenueCard key={v.venue_name} venue={v} />
        ))}
        {data && listVenues.length === 0 && (
          <p className="ff-empty">
            No fish fries match those filters. Loosen up — it&rsquo;s Friday.
          </p>
        )}
      </section>

      <footer className="ff-footer">
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
      </footer>
    </div>
  );
}
