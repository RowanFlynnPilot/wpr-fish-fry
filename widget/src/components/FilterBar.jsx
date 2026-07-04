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
  locNote,
}) {
  const fishOptions = [...new Set(venues.flatMap((v) => v.fish))].sort();
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

  return (
    <div className="ff-filters">
      <div className="ff-filter-group">
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
      </div>

      <div className="ff-filter-group">
        <span className="ff-filter-label">Fish</span>
        <div className="ff-chips">
          {fishOptions.map((fish) => (
            <button
              key={fish}
              type="button"
              className={`ff-chip ${filters.fish.includes(fish) ? "is-on" : ""}`}
              aria-pressed={filters.fish.includes(fish)}
              onClick={() => toggleValue("fish", fish)}
            >
              {fish}
            </button>
          ))}
        </div>
      </div>

      <div className="ff-filter-group">
        <span className="ff-filter-label">Venue</span>
        <div className="ff-chips">
          {typeOptions.map((t) => (
            <button
              key={t}
              type="button"
              className={`ff-chip ${filters.types.includes(t) ? "is-on" : ""}`}
              aria-pressed={filters.types.includes(t)}
              onClick={() => toggleValue("types", t)}
            >
              {TYPE_LABELS[t]}
            </button>
          ))}
          <button
            type="button"
            className={`ff-chip ff-chip-flag ${filters.takeout ? "is-on" : ""}`}
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
          {locNote && <span className="ff-locnote">{locNote}</span>}
        </div>
      </div>
    </div>
  );
}
