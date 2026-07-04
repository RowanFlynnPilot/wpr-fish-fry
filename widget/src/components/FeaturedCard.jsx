import VenueCard from "./VenueCard.jsx";

export default function FeaturedCard({ venue, onShowMap, distance, selected }) {
  return (
    <section className="ff-featured" aria-label="This week's featured fry">
      <div className="ff-featured-badge">This Week&rsquo;s Featured Fry</div>
      <VenueCard
        venue={venue}
        featured
        onShowMap={onShowMap}
        distance={distance}
        selected={selected}
      />
    </section>
  );
}
