import { useEffect, useRef } from "react";
import L from "leaflet";
import { priceRange } from "./VenueCard.jsx";

// Supper clubs deserve their own icon. This is Wisconsin.
const TYPE_GLYPH = {
  restaurant: "🍴",
  supper_club: "🥂",
  bar: "🍺",
  vfw_legion: "🎖️",
};

const WAUSAU = [44.9591, -89.6301];

const REDUCED_MOTION = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

function popupHtml(v) {
  const destination = encodeURIComponent(`${v.address}, ${v.city}, WI`);
  return (
    `<strong>${v.venue_name}</strong><br>` +
    `${v.fish.join(", ")} · ${priceRange(v)}<br>` +
    `${v.hours}<br>` +
    `<a href="https://www.google.com/maps/dir/?api=1&destination=${destination}" ` +
    `target="_blank" rel="noreferrer">Directions</a>`
  );
}

export default function MapView({ venues, focus, onMarkerClick }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false, // embedded iframe: don't hijack article scroll
    }).setView(WAUSAU, 10);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => map.remove();
  }, []);

  useEffect(() => {
    const layer = layerRef.current;
    layer.clearLayers();
    markersRef.current = {};
    venues.forEach((v) => {
      // The featured (paid) venue gets a black ring, nothing louder.
      const icon = L.divIcon({
        className: `ff-marker ${v.featured_this_week ? "ff-marker-featured" : ""}`,
        html: `<span>${TYPE_GLYPH[v.venue_type]}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });
      const marker = L.marker([v.lat, v.lon], { icon })
        .bindPopup(popupHtml(v))
        .addTo(layer);
      marker.on("click", () => onMarkerClick(v.venue_name));
      markersRef.current[v.venue_name] = marker;
    });
    if (venues.length > 0) {
      const bounds = L.latLngBounds(venues.map((v) => [v.lat, v.lon]));
      mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [venues, onMarkerClick]);

  useEffect(() => {
    if (!focus || focus.source !== "list") return;
    const marker = markersRef.current[focus.name];
    if (!marker) return;
    const map = mapRef.current;
    const zoom = Math.max(map.getZoom(), 13);
    if (REDUCED_MOTION) {
      map.setView(marker.getLatLng(), zoom);
    } else {
      map.flyTo(marker.getLatLng(), zoom);
    }
    marker.openPopup();
  }, [focus]);

  return <div className="ff-map" ref={containerRef} />;
}
