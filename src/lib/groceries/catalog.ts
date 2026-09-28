/**
 * Small, dependency-free helpers for the grocery catalog: tidy a typed name
 * into a canonical one, and guess an icon for a brand-new item from the words
 * in it. The catalog remembers the icon after that, so this only has to be
 * good enough for the first time something is added — an admin can correct it.
 */

export function normalizeName(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ").slice(0, 60);
  if (!trimmed) return "";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Keyword -> emoji. First match wins, so put specific words before general
// ones. Matched against the lower-cased name as whole-word-ish substrings.
const ICONS: [RegExp, string][] = [
  // Order matters — first match wins, so keep specific terms above general ones
  // (e.g. "sweet potato" before "potato", "peanut butter" before "butter").
  // Fruit
  [/\bsorbet\b|island way/, "ic:sorbet"],
  [/\bsweet potato|\byams?\b/, "🍠"],
  [/\bapples?\b/, "🍎"],
  [/\bbananas?\b/, "🍌"],
  [/\boranges?|mandarin|tangerine|clementine\b/, "🍊"],
  [/\b(lemons?|limes?)\b/, "🍋"],
  [/\bstrawberr/, "🍓"],
  [/\b(blue|rasp|black|cran)berr(y|ies)\b/, "🫐"],
  [/\bberr(y|ies)\b/, "🫐"],
  [/\bgrapes?\b/, "🍇"],
  [/\b(watermelon|melon|cantaloupe|honeydew)\b/, "🍉"],
  [/\bcherr(y|ies)\b/, "🍒"],
  [/\b(peach|peaches|nectarine)\b/, "🍑"],
  [/\bpears?\b/, "🍐"],
  [/\bmango(es)?\b/, "🥭"],
  [/\bpineapple/, "🍍"],
  [/\bcoconut/, "🥥"],
  [/\bkiwi/, "🥝"],
  [/\bavocado/, "🥑"],
  [/\btomato/, "🍅"],
  // Vegetables
  [/\bpotato/, "🥔"],
  [/\bcarrots?\b/, "🥕"],
  [/\b(onions?|shallots?|scallions?)\b/, "🧅"],
  [/\bgarlic\b/, "🧄"],
  [/\bchil(i|li|e)|jalape|serrano|habanero\b/, "🌶️"],
  [/\bpeppers?\b/, "🫑"],
  [/\bcorn\b/, "🌽"],
  [/\bbroccoli\b/, "🥦"],
  [/\b(lettuce|spinach|kale|cabbage|greens?|salad|arugula|collard)\b/, "🥬"],
  [/\b(cucumber|pickles?)\b/, "🥒"],
  [/\bmushroom/, "🍄"],
  [/\b(eggplant|aubergine)\b/, "🍆"],
  [/\b(peas|edamame|snap peas)\b/, "🫛"],
  [/\b(beans?|lentils?|chickpeas?|legume)/, "🫘"],
  [/\bolives?\b/, "🫒"],
  // Dairy & eggs
  [/\bmilk\b/, "🥛"],
  [/\beggs?\b/, "🥚"],
  [/\b(peanut|almond|nut) butter\b/, "🥜"],
  [/\bbutter\b/, "🧈"],
  [/\bcheese\b/, "🧀"],
  [/\byogh?urt\b/, "mdi:cup-outline"],
  [/\bice ?cream\b/, "🍦"],
  [/\bcreamer?\b/, "mdi:cup-outline"],
  // Bakery
  [/\b(bread|toast|bagel|buns?|rolls?|loaf)\b/, "🍞"],
  [/\b(baguette|sourdough)\b/, "🥖"],
  [/\bcroissant\b/, "🥐"],
  [/\bpretzel/, "🥨"],
  [/\bwaffles?\b/, "🧇"],
  [/\b(pancakes?|crepes?)\b/, "🥞"],
  [/\b(donut|doughnut)/, "🍩"],
  [/\b(cookie|biscuit)/, "🍪"],
  [/\b(cupcake|muffin)/, "🧁"],
  [/\bcakes?\b/, "🍰"],
  [/\bpies?\b/, "🥧"],
  // Meat & seafood
  [/\b(chicken|poultry|turkey)\b/, "🍗"],
  [/\b(beef|steak|mince)\b/, "🥩"],
  [/\b(bacon|ham|pork|prosciutto)\b/, "🥓"],
  [/\b(sausage|hot ?dog|bratwurst|frank)/, "🌭"],
  [/\b(lamb|ribs?)\b/, "🍖"],
  [/\b(salmon|tuna|cod|tilapia|fish)\b/, "🐟"],
  [/\b(shrimp|prawns?)\b/, "🍤"],
  [/\bcrab\b/, "🦀"],
  [/\blobster\b/, "🦞"],
  [/\b(squid|calamari)\b/, "🦑"],
  [/\b(oysters?|clams?|mussels?|scallops?)\b/, "🦪"],
  // Pantry & grains
  [/\brice\b/, "🍚"],
  [/\b(ramen|udon|soba)\b/, "🍜"],
  [/\b(pasta|spaghetti|noodles?|macaroni|penne|lasagna)\b/, "🍝"],
  [/\b(cereal|oats|granola|muesli)\b/, "🥣"],
  [/\bflour\b/, "mdi:sack"],
  [/\bsugar\b/, "mdi:spoon-sugar"],
  [/\bsalt\b/, "🧂"],
  [/\b(cinnamon|paprika|cumin|nutmeg|seasoning|spice)\b/, "mdi:shaker-outline"],
  [/\bhoney\b/, "🍯"],
  [/\b(oil|vinegar)\b/, "mdi:bottle-tonic-outline"],
  [/\b(peanut|almond|walnut|cashew|pistachio|nuts?)\b/, "🥜"],
  [/\b(soup|broth|stock|canned|sauce|salsa|ketchup|mustard|mayo|gravy)\b/, "mdi:soy-sauce"],
  // Snacks & sweets
  [/\b(chips|crisps|fries)\b/, "🍟"],
  [/\bpopcorn\b/, "🍿"],
  [/\b(chocolate|cocoa)\b/, "🍫"],
  [/\b(cand(y|ies)|sweets|gummy|lollipop)\b/, "🍬"],
  [/\bgum\b/, "🍬"],
  [/\bcrackers?\b/, "🍘"],
  // Drinks
  [/\bcoffee\b/, "☕"],
  [/\btea\b/, "🍵"],
  [/\bjuice\b/, "mdi:bottle-tonic-outline"],
  [/\b(bottled water|water bottle)\b/, "ic:waterbottle"],
  [/\bprotein\b/, "ic:protein"],
  [/\bwater\b/, "💧"],
  [/\b(soda|cola|pop|soft drink|sparkling)\b/, "mdi:bottle-soda-classic"],
  [/\bwine\b/, "🍷"],
  [/\b(beer|ale|lager)\b/, "🍺"],
  // Prepared / frozen
  [/\bpizza\b/, "🍕"],
  [/\bsushi\b/, "🍣"],
  [/\btacos?\b/, "🌮"],
  [/\b(burrito|wrap)\b/, "🌯"],
  [/\b(dumpling|gyoza|potsticker)/, "🥟"],
  [/\b(herbs?|basil|parsley|cilantro|thyme|rosemary|oregano|mint)\b/, "🌿"],
  // Household & personal
  [/\b(paper towels?|kitchen roll)\b/, "ic:papertowel"],
  [/\btoilet paper\b/, "🧻"],
  [/\b(tissues?|kleenex)\b/, "mdi:box"],
  [/\b(napkins?|serviette)\b/, "ic:napkin"],
  [/\b(detergent|cleaner|bleach|sanitizer|disinfectant)\b/, "mdi:spray-bottle"],
  [/\b(soap|shampoo|conditioner|body ?wash)\b/, "mdi:pump"],
  [/\b(sponge|scrubber)\b/, "🧽"],
  [/\b(toothpaste|toothbrush|floss)\b/, "🪥"],
  [/\bbatter(y|ies)\b/, "🔋"],
  [/\b(shirt|clothes|clothing|socks|pants|jacket|underwear)\b/, "👕"],
  [/\b(shoes|boots|sneakers)\b/, "👟"],
  [/\b(medicine|pills?|vitamins?|tylenol|advil|ibuprofen|aspirin)\b/, "💊"],
  [/\b(diapers?|nappy|nappies)\b/, "mdi:diaper-outline"],
  [/\b(formula|baby bottle)\b/, "🍼"],
  [/\bflowers?\b/, "💐"],
  [/\b(light ?bulb|bulb)\b/, "💡"],
  [/\b(trash|garbage|bin bags?)\b/, "🗑️"],
  [/\b(dog|cat|pet)\b/, "mdi:bowl-mix-outline"],
];

/** Distinct icons the guesser knows, in first-seen order \u2014 the palette the
 *  admin icon picker offers. An item can still be set to any typed emoji. */
export const ICON_CHOICES: string[] = Array.from(new Set(ICONS.map(([, icon]) => icon)));

export type IconGuess = { icon: string; confident: boolean };

/**
 * Pick an icon for an item name. Instead of "first rule in the list wins" (which
 * let a modifier steal a compound name, e.g. "cherry tomatoes" -> cherry), collect
 * every matching rule and prefer the one whose match ends latest -- the head noun
 * of an English "modifier head" name ("cherry TOMATO", "fish SAUCE", "apple JUICE")
 * -- breaking ties toward the longer, more specific match so a phrase rule like
 * "peanut butter" beats bare "butter".
 *
 * `confident` is false when the name is genuinely ambiguous: nothing matched, or
 * two disjoint rules did (a real compound). It stays true for a single match or a
 * phrase rule that spans its components, so the admin only flags the real unknowns.
 */
export function guessIconInfo(name: string): IconGuess {
  const n = name.toLowerCase();
  const hits: { icon: string; start: number; end: number; len: number }[] = [];
  for (const [re, icon] of ICONS) {
    const m = re.exec(n);
    if (m) hits.push({ icon, start: m.index, end: m.index + m[0].length, len: m[0].length });
  }
  if (hits.length === 0) return { icon: "📦", confident: false };
  hits.sort((a, b) => b.end - a.end || b.len - a.len);
  const top = hits[0];
  const confident = hits.every((h) => h === top || (h.start >= top.start && h.end <= top.end));
  return { icon: top.icon, confident };
}

export function guessIcon(name: string): string {
  return guessIconInfo(name).icon;
}
