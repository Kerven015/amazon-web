/**
 * Mock review text, grouped by what the product is, so a muslin cloth never gets
 * "thick hotel feel" and a bath mat never gets "best towels I've owned".
 * Every entry is used at most once across the whole catalogue (see reviewsFor),
 * so no two products share a review. [stars, title, text, only-for-trait?]
 */
/** Optional 4th item: a trait the product must have (see productTraits in product-details.ts). */
export type PoolEntry = readonly [stars: number, title: string, text: string, only?: string];

export type ReviewGroup = "bath-plush" | "bath-light" | "bath-mid" | "beach" | "baby" | "kitchen" | "mat" | "robe" | "bundle";

/** Lines that fit any towel, robe or mat — used once a product's own group runs out. */
export const ANY_POOL: PoolEntry[] = [
  [5, "Colour is just right", "The colour is exactly as it looks in the photos — a calm, natural shade."],
  [5, "Beautifully made", "Neat stitching and no loose threads anywhere. You can tell it's well made."],
  [5, "Lovely to give", "Arrived folded and tied with a ribbon, so it went straight to my friend as a gift."],
  [5, "Still like new", "We've had it for months and it still looks and feels like new."],
  [5, "Quality you can feel", "As soon as I unwrapped it I could feel the difference from cheaper ones."],
  [5, "No chemical smell", "Smelled of nothing at all out of the box, which I really appreciate."],
  [5, "Exactly as described", "Size, colour and feel are all exactly as described on the page."],
  [5, "Easy care", "Goes in with the normal wash and comes out looking great."],
  [5, "Feels responsibly made", "Nice to buy something certified and made to last instead of replacing it every year."],
  [5, "Second order already", "Ordered one to try, and placed a second order a week later."],
  [4, "Very nice, pricey", "Lovely quality, though it's a bit of a treat at this price."],
  [4, "Good, slightly different shade", "Very nice, but the shade is a little warmer than on my screen."],
  [4, "Nice, slow delivery", "Lovely product. Delivery took a day longer than promised."],
  [3, "Okay, nothing special", "Perfectly fine, but I expected a little more for the price."],
  [2, "Colour not as pictured", "Quality is fine, but the colour was quite different from the photo."],
];

export const REVIEW_POOLS: Record<ReviewGroup, PoolEntry[]> = {
  /* Heavy terry bath towels (600+ GSM) */
  "bath-plush": [
    [5, "Proper hotel weight", "Heavy, dense and genuinely absorbent from the first use — it feels like the towels at a good hotel."],
    [5, "Sink-in soft", "There's real depth to the pile. Wrapping up in it after a shower is the best part of my morning."],
    [5, "Dries me in seconds", "One pat-down and I'm dry. The long loops soak up far more than our old towels did."],
    [5, "Fluffier after washing", "I was worried the loops would flatten, but after six washes they're fluffier than when they arrived."],
    [5, "Worth the extra weight", "Takes a little longer to dry on the rail because it's so thick, but that's the trade-off for this kind of softness."],
    [5, "Replaced every towel we had", "We bought one to try and ended up replacing the whole cupboard. The edges are beautifully finished."],
    [5, "No musty smell", "Even in our small bathroom with no window it dries overnight and never smells damp."],
    [5, "Great for long hair", "I use the bath sheet as a hair wrap too — it takes the water out without any frizz.", "bath-sheet"],
    [5, "Thick but not stiff", "Plenty of weight without feeling like cardboard. It drapes nicely over the heated rail."],
    [5, "Colour hasn't faded", "The darker shade looks exactly as it did on day one after two months of weekly washes.", "dark"],
    [5, "Ribbed texture is lovely", "The ribs give it a slightly exfoliating feel that I really like after the gym.", "ribbed"],
    [4, "Soft, sheds a little at first", "It left some lint on my dressing gown for the first two washes. Since then it's been perfect."],
    [4, "Lovely, slow to dry", "Beautifully soft, though in winter it needs a radiator to dry by the next day."],
    [4, "A touch heavier than expected", "Fantastic quality, but the bath sheet is almost too heavy for my little one to use."],
    [3, "Good, not quite as plush as hoped", "Soft and absorbent, but at this weight I expected a bit more of a sink-in feel."],
    [3, "Pulled loop after a month", "Still a nice towel, but one loop snagged on a zip and pulled. Easy to trim, but a shame."],
    [2, "Too heavy for our dryer", "The towels are lovely but our small dryer struggles with them, so they take ages."],
  ],
  /* Waffle and flat-woven bath towels (light, quick-dry) */
  "bath-light": [
    [5, "Dries before I'm dressed", "Hang it on the hook and it's dry within the hour. Perfect for a small, steamy bathroom."],
    [5, "Light but absorbent", "I didn't think something this thin could dry me off so well — it works better than our fluffy ones."],
    [5, "Great for travel", "Folds down to almost nothing, so it goes in my gym bag and on every holiday now."],
    [5, "The waffle texture softens", "A little crisp at first, then noticeably softer after a few washes. Love the honeycomb look.", "waffle"],
    [5, "Beach, bath and picnic", "We use it as a towel, a sarong and a picnic blanket. The stripes still look crisp.", "flatweave"],
    [5, "Ideal for hot summers", "On humid days a thick towel never dries. This one is light enough to be useful all summer."],
    [5, "No damp towel smell", "Because it dries so quickly it stays fresh for days between washes."],
    [5, "Lovely fringed edges", "The fringe is tightly knotted and hasn't unravelled at all in the washing machine.", "flatweave"],
    [4, "Takes a few washes to soften", "Felt a little stiff out of the packet. After three washes it's lovely.", "waffle"],
    [4, "Thinner than I pictured", "Exactly what the description says, I just pictured it a bit thicker. It works really well."],
    [3, "Nice, but not cosy", "Does the job and dries fast, but I miss the snuggly feel of a terry towel in winter."],
    [2, "Shrank more than expected", "It came out of the first hot wash noticeably smaller. Wash it cooler than I did."],
  ],
  /* Mid-weight terry (bamboo blend) */
  "bath-mid": [
    [5, "Silky and soft", "The bamboo blend has a slight sheen and feels silky against the skin. Really pleasant.", "bamboo"],
    [5, "Dries quicker than cotton", "Noticeably quicker to dry than our all-cotton towels, but still soft and thirsty.", "bamboo"],
    [5, "The whole family loves them", "Bought a set in different colours so everyone knows which towel is theirs."],
    [5, "Good everyday towel", "Not too heavy, not too thin. It's the one I reach for every morning."],
    [4, "Soft, colour a shade lighter", "The sage is a touch lighter than on my screen, but the towel itself is lovely.", "colour:Sage"],
    [4, "Lovely, slight snag", "Very soft and dries fast. One small snag after a month, otherwise great."],
    [3, "Fine for the price", "Decent towel at a good price, though not as luxurious as our heavier ones."],
  ],
  beach: [
    [5, "Room for two", "Big enough for me and my daughter to lie on together, with space for the bag.", "velour"],
    [5, "Sand really does shake off", "One shake and the sand is gone. No more half the beach coming home in the car.", "microfibre"],
    [5, "Packs into a tiny pouch", "Takes up hardly any room in the beach bag and is dry again by the time we leave.", "microfibre"],
    [5, "Bright colours stay bright", "A whole summer of sun and salt water and the stripes haven't faded.", "patterned"],
    [5, "Soft velour side", "The velour face feels lovely on the skin, and the terry back still dries you properly.", "velour"],
    [5, "Doesn't blow away", "Heavy enough that it stays put on a breezy beach.", "velour"],
    [4, "Great, slightly slippery", "Love how quick it dries. The smooth surface takes a moment to get used to.", "microfibre"],
    [4, "Big and soft, slow to dry", "Generous size and very soft, but it's still a little damp when we pack up.", "velour"],
    [3, "Good, but not very absorbent", "Fine for lying on, but I bring a regular towel for drying off after swimming.", "microfibre"],
  ],
  baby: [
    [5, "Hood fits perfectly", "The hood stays put on my son's head and keeps him warm straight out of the bath.", "hooded"],
    [5, "Gentle on sensitive skin", "My daughter has very sensitive skin and these haven't caused any redness at all."],
    [5, "Big enough to grow into", "Still wraps all the way round our two-year-old. It'll last for years.", "hooded"],
    [5, "Soft from the first wash", "So soft out of the packet, and even softer after washing with a baby detergent.", "hooded"],
    [5, "Perfect baby shower gift", "Bought one for a friend and kept one for us. Looks lovely wrapped up.", "hooded"],
    [5, "Muslins for everything", "We use them for bath time, burp cloths and wiping sticky hands. They wash beautifully.", "muslin"],
    [5, "Get softer every wash", "The muslin was a bit crinkly at first and has turned beautifully soft.", "muslin"],
    [4, "Lovely, hood a bit small", "The towel is great, but the hood is snug on our baby's big head.", "hooded"],
    [4, "Soft, colour lighter than shown", "The blush is paler than I expected, but it's still very sweet.", "colour:Blush"],
    [3, "Thinner than expected", "Nice cloths, but thinner than the muslins we had before.", "muslin"],
  ],
  kitchen: [
    [5, "Glass comes out streak-free", "I dry wine glasses with these and they come out spotless with no fluff.", "linen"],
    [5, "No lint at all", "Finally tea towels that don't leave bits all over the plates.", "linen"],
    [5, "Better with age", "The linen keeps getting softer and more absorbent the more I wash it.", "linen"],
    [5, "Dries fast on the oven door", "The waffle weave dries quickly between uses, so they never smell musty.", "waffle"],
    [5, "Pretty enough to leave out", "Lovely patterns — they hang on the oven handle and look nice in the kitchen.", "patterned"],
    [5, "Hold up to daily use", "Washed them dozens of times on a hot wash and they still look new."],
    [4, "Crisp at first", "A bit stiff to start with, but after a few washes they're perfect."],
    [4, "Good, would like a hanging loop", "Great at drying, but I wish they had a loop for hanging.", "waffle"],
    [3, "Creases easily", "Absorbent and well made, but they come out of the wash very creased.", "linen"],
  ],
  mat: [
    [5, "Soft underfoot", "Thick and cushioned — it's lovely to step out of the shower onto.", "tufted"],
    [5, "Doesn't slip", "Stays put on our tiled floor even when the kids jump out of the bath.", "reversible"],
    [5, "Dries between showers", "Even with four of us showering in the morning it's dry by the evening."],
    [5, "Washes well", "Came out of the machine looking just as good. The pile didn't flatten.", "tufted"],
    [5, "Two looks in one", "We flip it over every few weeks for a change. Both sides look great.", "reversible"],
    [5, "Bigger than our old mat", "Covers more of the floor in front of the bath, which means fewer wet footprints."],
    [4, "Lovely, shed at first", "Shed a little in the first wash, but it's been fine since."],
    [4, "Nice, slow to dry", "Very plush, though it takes a while to dry in our small bathroom.", "tufted"],
    [3, "A little thin", "Looks nice but thinner than I expected for a bath mat.", "reversible"],
  ],
  robe: [
    [5, "True to size", "I'm usually a medium and the medium fits perfectly, with room to layer underneath."],
    [5, "Weekend uniform", "I live in this on Sunday mornings. Warm without being heavy.", "terry"],
    [5, "Deep pockets", "Big pockets that actually hold a phone, and a belt that stays tied."],
    [5, "Light enough for summer", "The waffle weave is cool and light, so I can wear it all year round.", "waffle"],
    [5, "Feels like a spa", "Soft, long and cosy. It turned getting out of the bath into a treat.", "terry"],
    [5, "The collar is so cosy", "The shawl collar keeps my neck warm on cold mornings.", "shawl"],
    [4, "Lovely, sleeves a little long", "Gorgeous robe, but I have to roll the sleeves up once."],
    [4, "Runs slightly big", "Very comfortable, but I could have sized down."],
    [3, "Nice, but heavy when wet", "Soft and warm, but it gets heavy if you put it on straight out of the shower.", "terry"],
  ],
  bundle: [
    [5, "Everything matches", "Lovely to have a whole bathroom of towels that actually match.", "set:hand"],
    [5, "Great value set", "Cheaper than buying the pieces separately, and the quality is just as good."],
    [5, "Perfect housewarming gift", "Gave this to my sister for her new flat. It arrived beautifully packed."],
    [5, "Guest room sorted", "Our guests always comment on how soft the towels are.", "set:guest"],
    [5, "Robe, towel and mat in one go", "The robe is gorgeous, and the mat and bath sheet make it feel like a hotel.", "set:robe"],
    [5, "Good mix of sizes", "The set has exactly what we need — the face cloths get used every day.", "set:face"],
    [5, "Colour is spot on", "The colour matches the photos exactly, and every piece is the same shade."],
    [5, "Still soft after months", "We've used the set every day for three months and it's still soft.", "set:hand"],
    [4, "Lovely, would like two mats", "Everything's great, I just wish the set came with a second bath mat.", "set:robe"],
    [4, "Nice set, a little lint", "A bit of lint in the first wash, otherwise excellent.", "set:hand"],
    [3, "Hand towels on the small side", "The bath towels are lovely, but the hand towels are smaller than I expected.", "set:hand"],
  ],
};

/** Second sentences that fit any product; each is used at most once where possible. */
export const CLOSERS: Record<"good" | "ok" | "bad", string[]> = {
  good: [
    "Delivery was quick and the parcel was plastic-free.",
    "Would happily buy again.",
    "Already ordered another for my parents.",
    "Arrived two days earlier than expected.",
    "Really pleased with it.",
    "Lovely packaging too — no plastic anywhere.",
    "It's become a household favourite.",
    "Good value for the quality.",
    "My partner keeps stealing it.",
    "Highly recommend.",
    "Exactly what I was looking for.",
    "I'll be buying more colours.",
    "So glad I went for this one.",
    "Easy to recommend.",
    "Ten out of ten.",
    "Feels like it will last for years.",
  ],
  ok: ["Okay for the price.", "Not bad overall.", "Fine, but I probably wouldn't buy it again.", "It does the job."],
  bad: ["Customer service sorted out a return quickly.", "Returning it was easy, at least.", "Support replied the same day, to be fair."],
};

/** First names + initial; every review on a product gets a different author. */
export const AUTHORS = [
  "Hannah P.", "Marcus L.", "Aisha K.", "Tom W.", "Elena R.", "Jonah B.", "Priya S.", "Grace T.", "Sam O.", "Isabel M.",
  "Kenji N.", "Chloe D.", "Ravi P.", "Lucy H.", "Daniel F.", "Nora A.", "Aylin Y.", "Merdan A.", "Olga S.", "Emre K.",
  "Maya G.", "Owen J.", "Leila F.", "Dmitri V.", "Sofia C.", "Ben R.", "Selin D.", "Arslan B.", "Zoe M.", "Anya K.",
  "Felix H.", "Jasmine L.", "Can T.", "Ellie W.", "Hugo P.", "Mira N.", "Lewis A.", "Gulnara O.", "Theo S.", "Rosa E.",
];
