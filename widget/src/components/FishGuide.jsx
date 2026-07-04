// Editorial field guide, keyed to the FISH enum in build.py. Adding a new
// species to the sheet contract? Add its entry here too — the guide only
// renders species that appear in the live data.
const GUIDE = {
  perch: {
    title: "Lake Perch",
    flavor:
      "The Wisconsin benchmark. Sweet, mild, and delicate, with thin fillets that fry up shatter-crisp — if a kitchen can do perch right, trust the rest of the menu.",
    menu: "By the piece or as a dinner plate; the classic order comes with potato pancakes.",
    pairs:
      "Potato pancakes, rye bread, and tartar; a brandy old fashioned (sweet) is the traditional companion.",
  },
  walleye: {
    title: "Walleye",
    flavor:
      "The north-woods favorite — sweet, faintly nutty, with a firm but fine flake that stands up to the fryer without drying out.",
    menu: "Usually the premium dinner plate, battered or pan-fried; some spots do a walleye sandwich worth the drive.",
    pairs:
      "Baked potato or potato pancakes and slaw; an amber lager or an old fashioned.",
  },
  bluegill: {
    title: "Bluegill",
    flavor:
      "Panfish royalty. Small, sweet, almost buttery fillets with a light flake — the taste of a summer lake, deep-fried.",
    menu: "A platter of small fillets, often mixed with perch on combo plates.",
    pairs: "Potato salad and rye bread; keep the beer light so the fish leads.",
  },
  cod: {
    title: "Cod",
    flavor:
      "Mild, clean, and generous — big soft flakes under a sturdy beer batter. The workhorse of the all-you-can-eat fry.",
    menu: "AYCE plates, dinner baskets, and most fish sandwiches start here.",
    pairs: "Fries, coleslaw, and a squeeze of lemon; a pilsner or Wisconsin lager.",
  },
  haddock: {
    title: "Haddock",
    flavor:
      "Cod's slightly sweeter, more delicate cousin. A finer flake and a touch more character; it holds batter beautifully.",
    menu: "Dinner plates and sandwiches; often the step-up option next to cod.",
    pairs: "Fries with malt vinegar; a pale ale.",
  },
  smelt: {
    title: "Smelt",
    flavor:
      "The old-school tavern tradition — little fish, fried whole and crisp, briny-sweet and eaten by the basketful.",
    menu: "By the basket or the pound, often a first-Friday or seasonal special at Legion and VFW halls.",
    pairs: "Cocktail sauce, lemon, baked beans, and whatever's cold on tap.",
  },
  shrimp: {
    title: "Shrimp",
    flavor:
      "The loyal opposition for the not-fish eater at the table — snappy, sweet, breaded or beer-battered.",
    menu: "Baskets and combo plates alongside the fish.",
    pairs: "Cocktail sauce and fries; a crisp lager.",
  },
};

export default function FishGuide({ venues, onFindFish }) {
  const present = Object.keys(GUIDE).filter((f) =>
    venues.some((v) => v.fish.includes(f))
  );
  if (present.length === 0) return null;

  return (
    <section className="ff-guide" aria-label="Field guide to the fish">
      <h2 className="ff-guide-head">Know Your Fry</h2>
      <p className="ff-guide-tagline">
        A field guide to what&rsquo;s in the fryer — and what to order with it.
      </p>
      {present.map((key) => {
        const g = GUIDE[key];
        return (
          <details key={key} className="ff-guide-entry">
            <summary>{g.title}</summary>
            <div className="ff-guide-body">
              <p>{g.flavor}</p>
              <p>
                <strong>On the menu:</strong> {g.menu}
              </p>
              <p>
                <strong>Pairs with:</strong> {g.pairs}
              </p>
              <button
                type="button"
                className="ff-maplink"
                onClick={() => onFindFish(key)}
              >
                See who&rsquo;s frying {g.title.toLowerCase()} →
              </button>
            </div>
          </details>
        );
      })}
    </section>
  );
}
