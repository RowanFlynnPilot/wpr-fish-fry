import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet.markercluster";
import { directionsUrl, formatHours, priceRange } from "./VenueCard.jsx";
import { TYPE_LABELS } from "./FilterBar.jsx";

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

const properCase = (s) => s[0].toUpperCase() + s.slice(1);

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
  const clusterRef = useRef(null);
  const markersRef = useRef({});
  const youRef = useRef(null);

  useEffect(() => {
    const map = L.map(containerRef.current, {
      scrollWheelZoom: false, // embedded iframe: don't hijack article scroll
    }).setView(WAUSAU, 10);
    // Muted CARTO cartography so the newspaper palette does the talking.
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        maxZoom: 19,
      }
    ).addTo(map);

    const cluster = L.markerClusterGroup({
      maxClusterRadius: 42,
      disableClusteringAtZoom: 13,
      showCoverageOnHover: false,
      iconCreateFunction: (c) =>
        L.divIcon({
          className: "ff-cluster",
          html: `<span>${c.getChildCount()}</span>`,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        }),
    });
    map.addLayer(cluster);
    clusterRef.current = cluster;
    mapRef.current = map;

    // One delegated listener covers every popup's "Full listing" link.
    const onPopupClick = (e) => {
      const link = e.target.closest(".ff-popup-details");
      if (!link) return;
      e.preventDefault();
      onShowDetails(link.dataset.venue);
    };
    containerRef.current.addEventListener("click", onPopupClick);

    // Ctrl/⌘ + scroll zooms; plain scroll keeps scrolling the article and
    // briefly shows a hint. (Pinch-zoom on touch works regardless.)
    const hint = L.DomUtil.create("div", "ff-zoom-hint", containerRef.current);
    hint.textContent = /Mac/.test(navigator.userAgent)
      ? "Use ⌘ + scroll to zoom the map"
      : "Use Ctrl + scroll to zoom the map";
    let hintTimer = null;
    let lastWheelZoom = 0;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        hint.classList.remove("is-visible");
        const now = performance.now();
        if (now - lastWheelZoom < 180) return;
        lastWheelZoom = now;
        map.setZoomAround(
          map.mouseEventToLatLng(e),
          map.getZoom() + (e.deltaY < 0 ? 1 : -1)
        );
      } else {
        hint.classList.add("is-visible");
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => hint.classList.remove("is-visible"), 1100);
      }
    };
    containerRef.current.addEventListener("wheel", onWheel, { passive: false });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const cluster = clusterRef.current;
    cluster.clearLayers();
    markersRef.current = {};
    venues.forEach((v) => {
      // The featured (paid) venue gets a black ring, nothing louder.
      const icon = L.divIcon({
        className: `ff-marker ff-marker--${v.venue_type} ${v.featured_this_week ? "ff-marker-featured" : ""}`,
        html: `<span>${TYPE_GLYPH[v.venue_type]}</span>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });
      const marker = L.marker([v.lat, v.lon], { icon })
        .bindPopup(popupHtml(v, miles?.[v.venue_name]))
        .bindTooltip(
          `<strong>${v.venue_name}</strong> · ${priceRange(v)}`,
          {
            direction: "top",
            offset: [0, -20],
            opacity: 1,
            className: "ff-tooltip",
          }
        );
      cluster.addLayer(marker);
      markersRef.current[v.venue_name] = marker;
    });

    const points = venues.map((v) => [v.lat, v.lon]);
    if (userLoc) points.push([userLoc.lat, userLoc.lon]);
    if (points.length > 0) {
      mapRef.current.fitBounds(L.latLngBounds(points), {
        padding: [30, 30],
        maxZoom: 13,
      });
    }
  }, [venues, miles, userLoc]);

  // "You are here" pin whenever a distance sort gave us a reader location.
  useEffect(() => {
    const map = mapRef.current;
    if (youRef.current) {
      map.removeLayer(youRef.current);
      youRef.current = null;
    }
    if (userLoc) {
      youRef.current = L.circleMarker([userLoc.lat, userLoc.lon], {
        radius: 8,
        color: "#ffffff",
        weight: 2,
        fillColor: "#3a867c",
        fillOpacity: 1,
      })
        .bindPopup("You are here")
        .addTo(map);
    }
  }, [userLoc]);

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
    // Clustered markers need their cluster expanded before the popup opens.
    clusterRef.current.zoomToShowLayer(marker, () => marker.openPopup());
  }, [focus]);

  return <div className="ff-map" ref={containerRef} />;
}
