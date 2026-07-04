import VenueCard from "./VenueCard.jsx";

export default function FeaturedCard({ venue }) {
  return (
    <section className="ff-featured" aria-label="This week's featured fry">
      <div className="ff-featured-badge">This Week&rsquo;s Featured Fry</div>
      <VenueCard venue={venue} featured />
    </section>
  );
}
