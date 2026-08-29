import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { directionsUrl, formatHours, priceRange } from "./VenueCard.jsx";
import { TYPE_LABELS } from "./FilterBar.jsx";

// Supper clubs deserve their own icon. This is Wisconsin.
const TYPE_GLYPH = {
  restaurant: "🍴",
  supper_club: "🥂",
  bar: "🍺",
  vfw_legion: "🎖️",
};

const WAUSAU = [-89.6301, 44.9591]; // MapLibre speaks [lng, lat]

const REDUCED_MOTION = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const properCase = (s) => s[0].toUpperCase() + s.slice(1);

// Hand-styled OpenFreeMap vector basemap in the WPR palette — the Travel
// Portland treatment, shared with the On Tap tool: cream land, sage woods,
// teal water, gold highways, dashed county lines, and only place labels.
// Keyless and free for commercial use; nothing to expire.
const MAP_STYLE = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    omt: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
      attribution:
        '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    },
  },
  layers: [
    { id: "bg", type: "background", paint: { "background-color": "#F1EADA" } },
    { id: "wood", type: "fill", source: "omt", "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["wood", "forest"]]],
      paint: { "fill-color": "#D3DEC1", "fill-opacity": 0.8 } },
    { id: "grass", type: "fill", source: "omt", "source-layer": "landcover",
      filter: ["in", ["get", "class"], ["literal", ["grass", "farmland", "meadow", "wetland"]]],
      paint: { "fill-color": "#E3E7CD", "fill-opacity": 0.6 } },
    { id: "park", type: "fill", source: "omt", "source-layer": "park",
      paint: { "fill-color": "#CCDBB8", "fill-opacity": 0.7 } },
    { id: "residential", type: "fill", source: "omt", "source-layer": "landuse",
      filter: ["in", ["get", "class"], ["literal", ["residential", "suburb", "neighbourhood"]]],
      paint: { "fill-color": "#EBE2CE", "fill-opacity": 0.55 } },
    { id: "water", type: "fill", source: "omt", "source-layer": "water",
      paint: { "fill-color": "#A5C8C0" } },
    { id: "waterway", type: "line", source: "omt", "source-layer": "waterway",
      paint: { "line-color": "#A5C8C0",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.6, 13, 2.5] } },
    { id: "minor-roads", type: "line", source: "omt", "source-layer": "transportation", minzoom: 10,
      filter: ["in", ["get", "class"], ["literal", ["minor", "service"]]],
      paint: { "line-color": "#E7DDC4",
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 0.5, 15, 3] } },
    { id: "mid-roads", type: "line", source: "omt", "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["secondary", "tertiary"]]],
      paint: { "line-color": "#EBD9A6",
        "line-width": ["interpolate", ["linear"], ["zoom"], 8, 0.7, 14, 4] } },
    { id: "main-roads", type: "line", source: "omt", "source-layer": "transportation",
      filter: ["in", ["get", "class"], ["literal", ["motorway", "trunk", "primary"]]],
      paint: { "line-color": "#E5B963",
        "line-width": ["interpolate", ["linear"], ["zoom"], 7, 1.1, 14, 5.5] } },
    { id: "boundary", type: "line", source: "omt", "source-layer": "boundary",
      filter: ["all", ["<=", ["get", "admin_level"], 6], ["!=", ["get", "maritime"], 1]],
      paint: { "line-color": "#C8BEA6", "line-width": 1, "line-dasharray": [3, 2] } },
    { id: "city-labels", type: "symbol", source: "omt", "source-layer": "place",
      filter: ["in", ["get", "class"], ["literal", ["city", "town"]]],
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"],
        "text-size": ["match", ["get", "class"], "city", 14, 12.5] },
      paint: { "text-color": "#41493F", "text-halo-color": "#F1EADA", "text-halo-width": 1.3 } },
    { id: "village-labels", type: "symbol", source: "omt", "source-layer": "place", minzoom: 9.5,
      filter: ["==", ["get", "class"], "village"],
      layout: { "text-field": ["get", "name"], "text-font": ["Noto Sans Regular"], "text-size": 10.5 },
      paint: { "text-color": "#5A6157", "text-halo-color": "#F1EADA", "text-halo-width": 1.2 } },
  ],
};

function popupHtml(v, milesAway) {
  const dist =
    typeof milesAway === "number" ? ` · ${milesAway.toFixed(1)} mi` : "";
  return (
    `<strong>${v.venue_name}</strong><br>` +
    `<span class="ff-popup-type">${TYPE_LABELS[v.venue_type]}${dist}</span><br>` +
    `${v.fish.map(properCase).join(", ")} · ${priceRange(v)}<br>` +
    `${formatHours(v.hours)}<br>` +
    `<a href="${directionsUrl(v)}" target="_blank" rel="noreferrer">Directions</a>` +
    ` · <a href="#" class="ff-popup-details" data-venue="${v.venue_name.replace(/"/g, "&quot;")}">Full listing ↓</a>`
  );
}

export default function MapView({ venues, focus, userLoc, miles, onShowDetails }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]); // live maplibregl.Marker objects
  const byNameRef = useRef({}); // venue_name -> Marker (unclustered only)
  const venuesRef = useRef(venues);
  const milesRef = useRef(miles);
  const youRef = useRef(null);

  // Screen-space clustering, same as the On Tap tool: pins that would
  // overlap at the current zoom collapse into a numbered circle; clicking
  // it zooms in until the group splits. Re-run on every zoom change.
  const renderMarkers = () => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    byNameRef.current = {};

    const clusters = [];
    for (const v of venuesRef.current) {
      const p = map.project([v.lon, v.lat]);
      const hit = clusters.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < 40);
      if (hit) hit.items.push(v);
      else clusters.push({ x: p.x, y: p.y, items: [v] });
    }

    for (const c of clusters) {
      if (c.items.length === 1) {
        const v = c.items[0];
        const el = document.createElement("div");
        el.className = "ff-pin-wrap";
        el.innerHTML =
          `<div class="ff-pin ff-pin--${v.venue_type}` +
          `${v.featured_this_week ? " ff-pin-featured" : ""}">` +
          `<span>${TYPE_GLYPH[v.venue_type]}</span></div>` +
          `<div class="ff-pin-tip"><strong>${v.venue_name}</strong> · ${priceRange(v)}</div>`;
        const marker = new maplibregl.Marker({ element: el, anchor: "bottom" })
          .setLngLat([v.lon, v.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 34, closeButton: false }).setHTML(
              popupHtml(v, milesRef.current?.[v.venue_name])
            )
          )
          .addTo(map);
        byNameRef.current[v.venue_name] = marker;
        markersRef.current.push(marker);
      } else {
        const el = document.createElement("div");
        el.className = "ff-cluster";
        el.textContent = c.items.length;
        const lng = c.items.reduce((s, v) => s + v.lon, 0) / c.items.length;
        const lat = c.items.reduce((s, v) => s + v.lat, 0) / c.items.length;
        el.addEventListener("click", () =>
          map.easeTo({
            center: [lng, lat],
            zoom: map.getZoom() + 2.2,
            duration: REDUCED_MOTION ? 0 : 500,
          })
        );
        markersRef.current.push(
          new maplibregl.Marker({ element: el })
            .setLngLat([lng, lat])
            .addTo(map)
        );
      }
    }
  };

  useEffect(() => {
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: WAUSAU,
      zoom: 9,
      // The Travel Portland trick that matters inside a WordPress iframe:
      // plain scroll keeps scrolling the article; Ctrl/⌘ + scroll zooms,
      // with MapLibre's own overlay saying so. Pinch-zoom works regardless.
      cooperativeGestures: true,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }));
    mapRef.current = map;
    if (import.meta.env.DEV) window.__ffmap = map;

    map.on("zoomend", renderMarkers);

    // One delegated listener covers every popup's "Full listing" link.
    const onPopupClick = (e) => {
      const link = e.target.closest(".ff-popup-details");
      if (!link) return;
      e.preventDefault();
      onShowDetails(link.dataset.venue);
    };
    containerRef.current.addEventListener("click", onPopupClick);

    // The container can be 0×0 at first paint in a lazy-loaded iframe —
    // give the map its real size once it has one.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(containerRef.current);

    return () => {
      ro.disconnect();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    venuesRef.current = venues;
    milesRef.current = miles;
    const map = mapRef.current;

    // Center on where the fish fries actually are: trim each axis to its
    // 5th–95th percentile so a lone far-out venue can't shrink the Wausau
    // mass to a corner dot. Small filtered sets show everything; the
    // featured venue (paid placement) and the reader's pin stay in frame.
    const points = venues.map((v) => [v.lon, v.lat]);
    if (points.length > 0) {
      let sw, ne;
      if (points.length < 20) {
        const lons = points.map((p) => p[0]);
        const lats = points.map((p) => p[1]);
        sw = [Math.min(...lons), Math.min(...lats)];
        ne = [Math.max(...lons), Math.max(...lats)];
      } else {
        const at = (sorted, p) => sorted[Math.round((sorted.length - 1) * p)];
        const lons = points.map((p) => p[0]).sort((a, b) => a - b);
        const lats = points.map((p) => p[1]).sort((a, b) => a - b);
        sw = [at(lons, 0.05), at(lats, 0.05)];
        ne = [at(lons, 0.95), at(lats, 0.95)];
      }
      const bounds = new maplibregl.LngLatBounds(sw, ne);
      const featured = venues.find((v) => v.featured_this_week);
      if (featured) bounds.extend([featured.lon, featured.lat]);
      if (userLoc) bounds.extend([userLoc.lon, userLoc.lat]);
      map.fitBounds(bounds, { padding: 30, maxZoom: 13, duration: 0 });
    }
    renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [venues, miles, userLoc]);

  // "You are here" pin whenever a distance sort gave us a reader location.
  useEffect(() => {
    if (youRef.current) {
      youRef.current.remove();
      youRef.current = null;
    }
    if (userLoc) {
      const el = document.createElement("div");
      el.className = "ff-you";
      youRef.current = new maplibregl.Marker({ element: el })
        .setLngLat([userLoc.lon, userLoc.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setText("You are here"))
        .addTo(mapRef.current);
    }
  }, [userLoc]);

  useEffect(() => {
    if (!focus || focus.source !== "list") return;
    const map = mapRef.current;
    const v = venuesRef.current.find((x) => x.venue_name === focus.name);
    if (!v) return;
    // Zoom 14 splits even the ~400m-spread rural pin groups, so the venue
    // is guaranteed its own pin — then open its popup once markers settle.
    const open = () => {
      const marker = byNameRef.current[focus.name];
      if (marker && !marker.getPopup().isOpen()) marker.togglePopup();
    };
    map.once("moveend", () => {
      renderMarkers();
      open();
    });
    map.flyTo({
      center: [v.lon, v.lat],
      zoom: Math.max(map.getZoom(), 14),
      duration: REDUCED_MOTION ? 0 : 1200,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus]);

  return <div className="ff-map" ref={containerRef} />;
}
