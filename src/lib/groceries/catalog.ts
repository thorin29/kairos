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
  [/\byogh?urt\b/, "🥛"],
  [/\bice ?cream\b/, "🍦"],
  [/\bcreamer?\b/, "🥛"],
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
  [/\bflour\b/, "🌾"],
  [/\bsugar\b/, "🍬"],
  [/\bsalt\b/, "🧂"],
  [/\b(cinnamon|paprika|cumin|nutmeg|seasoning|spice)\b/, "🧂"],
  [/\bhoney\b/, "🍯"],
  [/\b(oil|vinegar)\b/, "🫒"],
  [/\b(peanut|almond|walnut|cashew|pistachio|nuts?)\b/, "🥜"],
  [/\b(soup|broth|stock|canned|sauce|salsa|ketchup|mustard|mayo|gravy)\b/, "🥫"],
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
  [/\bjuice\b/, "🧃"],
  [/\b(bottled water|water bottle)\b/, "ic:waterbottle"],
  [/\bprotein\b/, "ic:protein"],
  [/\bwater\b/, "💧"],
  [/\b(soda|cola|pop|soft drink|sparkling)\b/, "🥤"],
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
  [/\b(tissues?|kleenex)\b/, "🤧"],
  [/\b(napkins?|serviette)\b/, "ic:napkin"],
  [/\b(soap|detergent|shampoo|conditioner|cleaner|bleach|sanitizer)\b/, "🧼"],
  [/\b(sponge|scrubber)\b/, "🧽"],
  [/\b(toothpaste|toothbrush|floss)\b/, "🪥"],
  [/\bbatter(y|ies)\b/, "🔋"],
  [/\b(shirt|clothes|clothing|socks|pants|jacket|underwear)\b/, "👕"],
  [/\b(shoes|boots|sneakers)\b/, "👟"],
  [/\b(medicine|pills?|vitamins?|tylenol|advil|ibuprofen|aspirin)\b/, "💊"],
  [/\b(diapers?|nappy|nappies)\b/, "🧷"],
  [/\b(formula|baby bottle)\b/, "🍼"],
  [/\bflowers?\b/, "💐"],
  [/\b(light ?bulb|bulb)\b/, "💡"],
  [/\b(trash|garbage|bin bags?)\b/, "🗑️"],
  [/\b(dog|cat|pet)\b/, "🐾"],
];

export function guessIcon(name: string): string {
  const n = name.toLowerCase();
  for (const [re, icon] of ICONS) if (re.test(n)) return icon;
  return "📦";
}
