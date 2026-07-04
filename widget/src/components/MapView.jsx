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

export default function MapView({ venues }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

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
    venues.forEach((v) => {
      const icon = L.divIcon({
        className: "ff-marker",
        html: `<span>${TYPE_GLYPH[v.venue_type]}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });
      L.marker([v.lat, v.lon], { icon })
        .bindPopup(
          `<strong>${v.venue_name}</strong><br>${v.fish.join(", ")}<br>${v.hours}`
        )
        .addTo(layer);
    });
    if (venues.length > 0) {
      const bounds = L.latLngBounds(venues.map((v) => [v.lat, v.lon]));
      mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
    }
  }, [venues]);

  return <div className="ff-map" ref={containerRef} />;
}
