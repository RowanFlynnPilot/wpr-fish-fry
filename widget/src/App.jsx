import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import FilterBar from "./components/FilterBar.jsx";
import MapView from "./components/MapView.jsx";
import FeaturedCard from "./components/FeaturedCard.jsx";
import VenueCard from "./components/VenueCard.jsx";
import FishGuide from "./components/FishGuide.jsx";

// Page scrolls are instant, not smooth: smooth scrollIntoView silently
// no-ops in some embedded/iframe contexts (notably mobile Safari across
// the WordPress iframe boundary), and instant works everywhere. The card
// highlight pulse handles orientation.
const EMPTY_FILTERS = {
  q: "",
  county: "",
  city: "",
  fish: [],
  types: [],
  takeout: false,
  ayce: false,
};

export function venueSlug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// One predicate, used both for the live list and for the empty state's
// "which single filter is doing the damage?" probe.
function matchesFilters(v, f) {
  const q = f.q.trim().toLowerCase();
  return (
    (!q || `${v.venue_name} ${v.city} ${v.county}`.toLowerCase().includes(q)) &&
    (!f.county || v.county === f.county) &&
    (!f.city || v.city === f.city) &&
    (f.fish.length === 0 || f.fish.some((x) => v.fish.includes(x))) &&
    (f.types.length === 0 || f.types.includes(v.venue_type)) &&
    (!f.takeout || v.takeout) &&
    (!f.ayce || v.all_you_can_eat)
  );
}

// A jump line back to the filters every dozen cards. The full embed is one
// 24,000px document inside an auto-height iframe: it never scrolls itself,
// so nothing can be pinned, and a single control at the end of 97 listings
// is a control nobody reaches.
const JUMP_EVERY = 12;

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

// compact: the fixed-height embed (embed.html). The frame never grows, so
// the venue list scrolls in its own panel, chrome slims down, and the
// height postMessage stays quiet — there is no listener to talk to.
export default function App({ compact = false }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState("name");
  const [userLoc, setUserLoc] = useState(null);
  const [locNote, setLocNote] = useState(null);
  const [focus, setFocus] = useState(null); // { name, source: "map" | "list", ts }

  const loadData = useCallback(() => {
    setError(null);
    fetch(`${import.meta.env.BASE_URL}data/fish_fry.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Data fetch failed with status ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  useEffect(loadData, [loadData]);

  // Embedded in a WordPress iframe: report our height so the parent page can
  // size the frame and the widget never scrolls-within-a-scroll.
  useEffect(() => {
    if (compact || window.parent === window) return;
    const post = () =>
      window.parent.postMessage(
        { type: "wpr-fish-fry:height", height: document.documentElement.scrollHeight },
        "*"
      );
    const observer = new ResizeObserver(post);
    observer.observe(document.documentElement);
    post();
    return () => observer.disconnect();
  }, [compact]);

  const venues = data ? data.venues : [];

  const filtered = useMemo(
    () => venues.filter((v) => matchesFilters(v, filters)),
    [venues, filters]
  );

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

  const sortByPrice = () => {
    setSort("price");
    setLocNote(null);
  };

  // Address-based distance: same Nominatim service the build uses, with the
  // search biased to the greater Wausau area so "Athens" means Athens, WI.
  const sortByAddress = async (query) => {
    const q = query.includes(",") ? query : `${query}, Wisconsin`;
    try {
      const resp = await fetch(
        "https://nominatim.openstreetmap.org/search?" +
          new URLSearchParams({
            q,
            format: "json",
            limit: "1",
            countrycodes: "us",
            viewbox: "-90.6,45.6,-88.9,44.4",
          })
      );
      const results = await resp.json();
      if (!results.length) {
        setLocNote("Couldn't find that address — try adding the town.");
        return;
      }
      setUserLoc({
        lat: parseFloat(results[0].lat),
        lon: parseFloat(results[0].lon),
      });
      setSort("distance");
      setLocNote(`Distances from ${results[0].display_name.split(",")[0]}.`);
    } catch {
      setLocNote("Address lookup didn't respond — try again in a moment.");
    }
  };

  // Can't decide? The wheel decides. Honors whatever filters are active.
  const surpriseMe = () => {
    const pool = filtered.length > 0 ? filtered : venues;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    focusVenue(pick.venue_name, "map");
  };

  const focusVenue = useCallback((name, source) => {
    setFocus({ name, source, ts: Date.now() });
  }, []);

  // Scrolling alone strands a keyboard reader: the control they activated is
  // now offscreen and Tab carries on from there. Move focus with the view.
  const goToResults = useCallback(() => {
    document.querySelector(".ff-results")?.scrollIntoView({ block: "start" });
    document.querySelector(".ff-count")?.focus({ preventScroll: true });
  }, []);

  // Guide → listings loop: filter to one species and jump to the results
  // header, which now sits above the map — so the reader lands on the new
  // count and a map of just that species.
  // In compact the header is pinned above the scroll panel — no jump.
  const findFish = useCallback(
    (fish) => {
      setFilters((f) => ({ ...f, fish: [fish] }));
      if (!compact) goToResults();
    },
    [compact, goToResults]
  );

  const onMarkerClick = useCallback(
    (name) => focusVenue(name, "map"),
    [focusVenue]
  );
  const onShowMap = useCallback(
    (name) => {
      focusVenue(name, "list");
      // The reader is deep in the list — bring the map back to them.
      // (Compact keeps the map pinned in view; nothing to scroll.)
      if (!compact) {
        const map = document.querySelector(".ff-map");
        map?.scrollIntoView({ block: "start" });
        map?.focus({ preventScroll: true });
      }
    },
    [focusVenue, compact]
  );

  useEffect(() => {
    if (!focus || focus.source !== "map") return;
    const el = document.getElementById(`venue-${venueSlug(focus.name)}`);
    if (el) el.scrollIntoView({ block: "center" });
  }, [focus]);

  // Hourly builds mean fresh data; if the pipeline breaks silently, tell
  // readers instead of letting them trust week-old hours.
  const staleHours = data
    ? (Date.now() - new Date(data.generated_at).getTime()) / 3.6e6
    : 0;

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
    if (sort === "price") {
      return [...rest].sort(
        (a, b) =>
          a.price_low - b.price_low ||
          a.price_high - b.price_high ||
          a.venue_name.localeCompare(b.venue_name)
      );
    }
    return rest;
  }, [filtered, featured, sort, userLoc, miles]);

  const hasFilters =
    filters.q.trim() !== "" ||
    filters.county !== "" ||
    filters.city !== "" ||
    filters.fish.length > 0 ||
    filters.types.length > 0 ||
    filters.takeout ||
    filters.ayce;
  const clearFilters = () => setFilters(EMPTY_FILTERS);
  const loading = !data && !error;

  // "No results" is a dead end unless it names the way out. Probe each active
  // filter on its own and offer to drop whichever one is costing the most.
  const loosen = useMemo(() => {
    if (!hasFilters || filtered.length > 0) return null;
    const q = filters.q.trim();
    const dims = [
      q && { key: "q", value: "", label: `the search for “${q}”` },
      filters.county && {
        key: "county",
        value: "",
        label: `the ${filters.county} County filter`,
      },
      filters.city && {
        key: "city",
        value: "",
        label: `the ${filters.city} filter`,
      },
      filters.fish.length > 0 && {
        key: "fish",
        value: [],
        label:
          filters.fish.length === 1
            ? `the ${filters.fish[0]} filter`
            : "the fish filters",
      },
      filters.types.length > 0 && {
        key: "types",
        value: [],
        label:
          filters.types.length === 1
            ? "the venue-type filter"
            : "the venue-type filters",
      },
      filters.takeout && { key: "takeout", value: false, label: "Takeout" },
      filters.ayce && { key: "ayce", value: false, label: "All You Can Eat" },
    ].filter(Boolean);
    let best = null;
    for (const d of dims) {
      const n = venues.filter((v) =>
        matchesFilters(v, { ...filters, [d.key]: d.value })
      ).length;
      if (n > 0 && (!best || n > best.n)) best = { ...d, n };
    }
    return best;
  }, [venues, filters, filtered.length, hasFilters]);

  const appClass = `ff-app ${compact ? "ff-app--compact" : ""}`;

  // The masthead ships with the error state too: a naked grey box dropped
  // mid-article reads as a broken page, not as our tool having a bad minute.
  const header = (
    <header className="ff-header">
      <img
        className="ff-badge"
        src={`${import.meta.env.BASE_URL}brand/wpr-typewriter-192.png`}
        alt="Wausau Pilot & Review"
        width="72"
        height="72"
      />
      <h1>Friday Fish Fry Finder</h1>
      {!compact && (
        <p className="ff-tagline">
          Every fish fry in Marathon County and its neighbors — the prices,
          the perch, the potato pancakes.
        </p>
      )}
    </header>
  );

  if (error) {
    return (
      <div className={appClass}>
        {header}
        <div className="ff-error">
          <p>
            The fish fry data didn&rsquo;t load ({error}). If it keeps
            happening, the newsroom knows where to find the build logs.
          </p>
          <button type="button" className="ff-chip" onClick={loadData}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={appClass}>
      {header}

      <FilterBar
        venues={venues}
        filters={filters}
        setFilters={setFilters}
        sort={sort}
        onSortName={sortByName}
        onSortDistance={sortByDistance}
        onSortPrice={sortByPrice}
        onSortAddress={sortByAddress}
        locNote={locNote}
      />

      {/* The results header sits between the filters and the map on purpose:
          it is the answer to the reader's question and the feedback for the
          control they just touched, and "Clear filters" belongs beside the
          filters rather than a map's height below them. */}
      <div className="ff-results">
        <h2 className="ff-count" tabIndex={-1}>
          {loading ? (
            <span className="ff-count-skel" aria-hidden="true" />
          ) : (
            <span aria-live="polite">
              {hasFilters
                ? `${filtered.length} of ${venues.length} fish fries match.`
                : `${venues.length} fish fries this Friday.`}
            </span>
          )}
        </h2>
        {data && (
          <p className="ff-count-actions">
            {hasFilters && (
              <button type="button" className="ff-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
            <button type="button" className="ff-clear" onClick={surpriseMe}>
              Can&rsquo;t decide? Spin for a fry
            </button>
          </p>
        )}
      </div>

      {data && staleHours > 26 && (
        <p className="ff-stale">
          Heads up: these listings haven&rsquo;t refreshed since{" "}
          {new Date(data.generated_at).toLocaleDateString("en-US", {
            weekday: "long",
            month: "short",
            day: "numeric",
          })}
          . Call ahead before you drive.
        </p>
      )}

      <MapView
        venues={filtered}
        focus={focus}
        userLoc={userLoc}
        miles={miles}
        onShowDetails={onMarkerClick}
      />
      <p className="ff-maplegend">
        <span className="ff-dot" /> 🍴 Restaurant &nbsp;·&nbsp;
        <span className="ff-dot ff-dot--supper_club" /> 🥂 Supper club
        &nbsp;·&nbsp;
        <span className="ff-dot ff-dot--bar" /> 🍺 Bar &amp; tavern
        &nbsp;·&nbsp;
        <span className="ff-dot ff-dot--vfw_legion" /> 🎖️ VFW &amp; Legion
        &nbsp;·&nbsp;
        <span className="ff-dot ff-dot--featured" /> featured fry
      </p>

      <div className={compact ? "ff-scroll" : undefined}>
      {featured && (
        <FeaturedCard
          venue={featured}
          onShowMap={onShowMap}
          distance={miles[featured.venue_name]}
          selected={focus?.name === featured.venue_name}
        />
      )}

      <section className="ff-list" aria-label="Fish fry listings">
        {loading &&
          [0, 1, 2].map((i) => <div key={i} className="ff-card ff-skeleton" />)}
        {listVenues.map((v, i) => (
          <Fragment key={v.venue_name}>
            {i > 0 && i % JUMP_EVERY === 0 && (
              <p className="ff-jump">
                <button
                  type="button"
                  className="ff-jumplink"
                  onClick={goToResults}
                >
                  ↑ Filters &amp; map
                </button>
              </p>
            )}
            <VenueCard
              venue={v}
              onShowMap={onShowMap}
              distance={miles[v.venue_name]}
              selected={focus?.name === v.venue_name}
            />
          </Fragment>
        ))}
        {data && listVenues.length === 0 && (
          <div className="ff-empty">
            <p>No fish fries match those filters. Loosen up — it&rsquo;s Friday.</p>
            {loosen && (
              <p className="ff-empty-hint">
                Dropping {loosen.label} would show {loosen.n}{" "}
                {loosen.n === 1 ? "fish fry" : "fish fries"}.{" "}
                <button
                  type="button"
                  className="ff-maplink"
                  onClick={() =>
                    setFilters((f) => ({ ...f, [loosen.key]: loosen.value }))
                  }
                >
                  Drop it
                </button>
              </p>
            )}
            <button type="button" className="ff-chip" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
        {listVenues.length > 3 && (
          <button type="button" className="ff-backtomap" onClick={goToResults}>
            ↑ Back to the map
          </button>
        )}
      </section>

      <FishGuide venues={venues} onFindFish={findFish} />

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

      {/* Pinned below the scroll panel, not inside it. The compact frame shows
          about one listing at a time, so its one exit to the full 97 must not
          sit 22,000px down the very panel the reader is stuck in. */}
      {compact && (
        <p className="ff-fullguide">
          <a
            href="https://rowanflynnpilot.github.io/wpr-fish-fry/"
            target="_blank"
            rel="noreferrer"
          >
            Open the full guide ↗
          </a>
        </p>
      )}
    </div>
  );
}
