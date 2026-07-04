import { useEffect, useRef } from "react";
import L from "leaflet";

// Supper clubs deserve their own icon. This is Wisconsin.
const TYPE_GLYPH = {
  restaurant: "🍴",
  supper_club: "🥂",
  bar: "🍺",
  vfw_legion: "🎖️",
};

const WAUSAU = [44.9591, -89.6301];
const BADGE = `${import.meta.env.BASE_URL}brand/wpr-typewriter-192.png`;

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
      // The weekly featured (paid) venue carries the WPR typewriter badge;
      // everyone else gets their venue-type glyph.
      const icon = L.divIcon({
        className: `ff-marker ${v.featured_this_week ? "ff-marker-featured" : ""}`,
        html: v.featured_this_week
          ? `<img src="${BADGE}" alt="">`
          : `<span>${TYPE_GLYPH[v.venue_type]}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });
      const marker = L.marker([v.lat, v.lon], { icon })
        .bindPopup(
          `<strong>${v.venue_name}</strong><br>${v.fish.join(", ")}<br>${v.hours}`
        )
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
    map.flyTo(marker.getLatLng(), Math.max(map.getZoom(), 13));
    marker.openPopup();
  }, [focus]);

  return <div className="ff-map" ref={containerRef} />;
}
