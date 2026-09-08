import { useEffect, useState } from "react";

// Below this width the filter groups stack, and the four of them together
// stand 490px tall — more than half a phone screen, all of it above the map
// and the listings. Fish and venue are refinements, not the way in, so they
// fold behind a disclosure and the reader reaches the fish fries first.
const NARROW = "(max-width: 640px)";

export const TYPE_LABELS = {
  restaurant: "Restaurant",
  supper_club: "Supper Club",
  bar: "Bar & Tavern",
  vfw_legion: "VFW & Legion",
};

export default function FilterBar({
  venues,
  filters,
  setFilters,
  sort,
  onSortName,
  onSortDistance,
  onSortPrice,
  onSortAddress,
  locNote,
}) {
  const [address, setAddress] = useState("");
  const [looking, setLooking] = useState(false);
  const [narrow, setNarrow] = useState(
    () => window.matchMedia(NARROW).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW);
    const onChange = (e) => setNarrow(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const submitAddress = async (e) => {
    e.preventDefault();
    if (!address.trim() || looking) return;
    setLooking(true);
    try {
      await onSortAddress(address.trim());
    } finally {
      setLooking(false);
    }
  };
  const fishOptions = [...new Set(venues.flatMap((v) => v.fish))].sort();
  // County → sorted towns, with venue counts for both. Rebuilt per render
  // from live data, so a county or town appears the moment it has a fry.
  const byCounty = new Map();
  venues.forEach((v) => {
    if (!v.county) return;
    const towns = byCounty.get(v.county) ?? new Map();
    towns.set(v.city, (towns.get(v.city) ?? 0) + 1);
    byCounty.set(v.county, towns);
  });
  const countyOptions = [...byCounty.keys()].sort();
  const countyCount = (c) =>
    [...byCounty.get(c).values()].reduce((a, b) => a + b, 0);
  // Town list narrows to the chosen county; otherwise grouped by county.
  const townGroups = (
    filters.county ? [filters.county] : countyOptions
  ).filter((c) => byCounty.has(c));
  const typeOptions = Object.keys(TYPE_LABELS).filter((t) =>
    venues.some((v) => v.venue_type === t)
  );

  const toggleValue = (key, value) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(value)
        ? f[key].filter((x) => x !== value)
        : [...f[key], value],
    }));

  const toggleFlag = (key) => setFilters((f) => ({ ...f, [key]: !f[key] }));

  // Shown on the collapsed summary so a hidden filter can never quietly
  // explain a short list.
  const refineCount =
    filters.fish.length +
    filters.types.length +
    (filters.takeout ? 1 : 0) +
    (filters.ayce ? 1 : 0);

  // Empty groups only happen before the data lands. A label pointing at no
  // chips reads as breakage, so the group waits for its options.
  const refineGroups = (fishOptions.length > 0 || typeOptions.length > 0) && (
    <>
      {fishOptions.length > 0 && (
        <div className="ff-filter-group">
          <span className="ff-filter-label">Fish</span>
          <div className="ff-chips">
            {fishOptions.map((fish) => (
              <button
                key={fish}
                type="button"
                className={`ff-chip ${
                  filters.fish.includes(fish) ? "is-on" : ""
                }`}
                aria-pressed={filters.fish.includes(fish)}
                onClick={() => toggleValue("fish", fish)}
              >
                {fish}
              </button>
            ))}
          </div>
        </div>
      )}

      {typeOptions.length > 0 && (
        <div className="ff-filter-group">
          <span className="ff-filter-label">Venue</span>
          <div className="ff-chips">
            {typeOptions.map((t) => (
              <button
                key={t}
                type="button"
                className={`ff-chip ${
                  filters.types.includes(t) ? "is-on" : ""
                }`}
                aria-pressed={filters.types.includes(t)}
                onClick={() => toggleValue("types", t)}
              >
                {TYPE_LABELS[t]}
              </button>
            ))}
            <button
              type="button"
              className={`ff-chip ff-chip-flag ${
                filters.takeout ? "is-on" : ""
              }`}
              aria-pressed={filters.takeout}
              onClick={() => toggleFlag("takeout")}
            >
              Takeout
            </button>
            <button
              type="button"
              className={`ff-chip ff-chip-flag ${filters.ayce ? "is-on" : ""}`}
              aria-pressed={filters.ayce}
              onClick={() => toggleFlag("ayce")}
            >
              All You Can Eat
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="ff-filters">
      <div className="ff-filter-group ff-filter-group--find">
        <label className="ff-filter-label" htmlFor="ff-search">
          Find
        </label>
        <input
          id="ff-search"
          className="ff-search"
          type="search"
          placeholder="Venue or town — try “Mosinee”"
          value={filters.q}
          onChange={(e) =>
            setFilters((f) => ({ ...f, q: e.target.value }))
          }
        />
        <div className="ff-where">
          {countyOptions.length > 1 && (
            <select
              className="ff-county"
              aria-label="Filter by county"
              value={filters.county}
              onChange={(e) =>
                // A new county invalidates any town picked under the old one.
                setFilters((f) => ({ ...f, county: e.target.value, city: "" }))
              }
            >
              <option value="">All counties</option>
              {countyOptions.map((c) => (
                <option key={c} value={c}>
                  {c} County ({countyCount(c)})
                </option>
              ))}
            </select>
          )}
          <select
            className="ff-county"
            aria-label="Filter by town"
            value={filters.city}
            onChange={(e) =>
              setFilters((f) => ({ ...f, city: e.target.value }))
            }
          >
            <option value="">All towns</option>
            {townGroups.map((c) => (
              <optgroup key={c} label={`${c} County`}>
                {[...byCounty.get(c).keys()].sort().map((t) => (
                  <option key={t} value={t}>
                    {t} ({byCounty.get(c).get(t)})
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>

      {narrow && refineGroups ? (
        <details className="ff-more">
          <summary className="ff-more-summary">
            Fish &amp; venue
            {refineCount > 0 && (
              <span className="ff-more-count">{refineCount} on</span>
            )}
          </summary>
          {refineGroups}
        </details>
      ) : (
        refineGroups
      )}

      <div className="ff-filter-group">
        <span className="ff-filter-label">Sort</span>
        <div className="ff-chips">
          <button
            type="button"
            className={`ff-chip ${sort === "name" ? "is-on" : ""}`}
            aria-pressed={sort === "name"}
            onClick={onSortName}
          >
            A–Z
          </button>
          <button
            type="button"
            className={`ff-chip ${sort === "distance" ? "is-on" : ""}`}
            aria-pressed={sort === "distance"}
            onClick={onSortDistance}
          >
            Nearest me
          </button>
          <button
            type="button"
            className={`ff-chip ${sort === "price" ? "is-on" : ""}`}
            aria-pressed={sort === "price"}
            onClick={onSortPrice}
          >
            Price
          </button>
          <form className="ff-addr" onSubmit={submitAddress}>
            <input
              className="ff-search ff-addr-input"
              type="text"
              placeholder="…or from an address"
              aria-label="Sort by distance from an address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <button
              type="submit"
              className="ff-chip"
              disabled={looking || !address.trim()}
            >
              {looking ? "Looking…" : "Go"}
            </button>
          </form>
          {locNote && <span className="ff-locnote">{locNote}</span>}
        </div>
      </div>
    </div>
  );
}
