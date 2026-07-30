import { TYPE_LABELS } from "./FilterBar.jsx";
import { venueSlug } from "../App.jsx";

// iPhone/iPad/Mac readers get Apple Maps (opens the native app); everyone
// else gets Google Maps. iPadOS reports as Macintosh — also covered.
const APPLE_PLATFORM = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent);

// Display-only cleanup for hand-typed hours: consistent en dashes and
// "11 AM" spacing, so "Fri 11AM-9PM" and "Fri 7 AM - 8 PM" render alike.
// The sheet data itself is never touched.
export function formatHours(hours) {
  return hours
    .replace(/\s*[-–—]\s*/g, "–")
    .replace(/(\d)\s*(am|pm)/gi, (_, d, ap) => `${d} ${ap.toUpperCase()}`);
}

export function directionsUrl(v) {
  const destination = encodeURIComponent(`${v.address}, ${v.city}, WI`);
  return APPLE_PLATFORM
    ? `https://maps.apple.com/?daddr=${destination}`
    : `https://www.google.com/maps/dir/?api=1&destination=${destination}`;
}

function money(n) {
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
}

export function priceRange(v) {
  return v.price_low === v.price_high
    ? money(v.price_low)
    : `${money(v.price_low)}–${money(v.price_high)}`;
}

export default function VenueCard({
  venue: v,
  featured = false,
  onShowMap,
  distance,
  selected = false,
}) {
  const paid = v.tier !== "free";

  return (
    <article
      id={`venue-${venueSlug(v.venue_name)}`}
      className={`ff-card ${featured ? "ff-card-featured" : ""} ${
        selected ? "is-selected" : ""
      }`}
    >
      {paid && v.photo_url && (
        <img
          className="ff-card-photo"
          src={
            v.photo_url.startsWith("http")
              ? v.photo_url
              : `${import.meta.env.BASE_URL}${v.photo_url}`
          }
          alt={v.venue_name}
          loading="lazy"
        />
      )}

      <div className="ff-card-body">
        <div className="ff-card-top">
          <span className="ff-type">{TYPE_LABELS[v.venue_type]}</span>
          {paid && <span className="ff-sponsor">Sponsor</span>}
        </div>

        <h3 className="ff-card-name">{v.venue_name}</h3>
        <p className="ff-card-place">
          {v.address}, {v.city}
        </p>

        <div className="ff-card-facts">
          <span className="ff-fact ff-price">{priceRange(v)}</span>
          <span className="ff-fact ff-hours">{formatHours(v.hours)}</span>
          {typeof distance === "number" && (
            <span className="ff-fact ff-dist">{distance.toFixed(1)} mi</span>
          )}
        </div>

        <div className="ff-tags">
          {v.fish.map((f) => (
            <span key={f} className="ff-tag ff-tag-fish">
              {f}
            </span>
          ))}
          {v.all_you_can_eat && <span className="ff-tag ff-tag-flag">All You Can Eat</span>}
          {v.takeout && <span className="ff-tag ff-tag-flag">Takeout</span>}
        </div>

        {v.sides && <p className="ff-sides">Sides: {v.sides}</p>}
        {paid && v.description && <p className="ff-desc">{v.description}</p>}
        {v.editor_note && <p className="ff-note">{v.editor_note}</p>}

        <div className="ff-links">
          {v.phone && <a href={`tel:${v.phone.replace(/[^0-9+]/g, "")}`}>{v.phone}</a>}
          <button
            type="button"
            className="ff-maplink"
            onClick={() => onShowMap(v.venue_name)}
          >
            Show on map
          </button>
          <a href={directionsUrl(v)} target="_blank" rel="noreferrer">
            Directions
          </a>
          {v.website && (
            <a href={v.website} target="_blank" rel="noreferrer">
              Website
            </a>
          )}
          {paid && v.menu_url && (
            <a href={v.menu_url} target="_blank" rel="noreferrer">
              Fish fry menu
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
