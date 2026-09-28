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
  [/\b(feta|mozz?arella|cheddar|parmesan|parmigiano|gouda|brie|ricotta|provolone|swiss|cotija|queso|halloumi|colby|monterey)\b/, "🧀"],
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
  [/\b(gatorade|powerade|sports drink|electrolyte|pedialyte|energy drink)\b/, "🥤"],
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
  [/\b(medicine|pills?|vitamins?|supplements?|magnesium|melatonin|probiotics?|collagen|omega|fish oil|tylenol|advil|ibuprofen|aspirin)\b/, "💊"],
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

/** Icon library for the admin picker \u2014 a broad, searchable pool decoupled from
 *  the guesser above. `keywords` is what the picker's search box matches against
 *  (substring, case-insensitive). Any emoji can still be set by pasting it. */
export type IconLibraryEntry = { icon: string; keywords: string };
export const GROCERY_ICON_LIBRARY: IconLibraryEntry[] = [
  // Fruit
  { icon: "🍎", keywords: "apple fruit red" },
  { icon: "🍏", keywords: "green apple fruit" },
  { icon: "🍌", keywords: "banana fruit" },
  { icon: "🍊", keywords: "orange mandarin tangerine clementine citrus fruit" },
  { icon: "🍋", keywords: "lemon lime citrus" },
  { icon: "🍓", keywords: "strawberry berry fruit" },
  { icon: "🫐", keywords: "blueberry blackberry raspberry cranberry berry berries" },
  { icon: "🍇", keywords: "grapes fruit raisin" },
  { icon: "🍉", keywords: "watermelon melon cantaloupe honeydew fruit" },
  { icon: "🍒", keywords: "cherry cherries fruit" },
  { icon: "🍑", keywords: "peach nectarine apricot fruit" },
  { icon: "🍐", keywords: "pear fruit" },
  { icon: "🥭", keywords: "mango fruit tropical" },
  { icon: "🍍", keywords: "pineapple fruit tropical" },
  { icon: "🥥", keywords: "coconut" },
  { icon: "🥝", keywords: "kiwi fruit" },
  { icon: "🥑", keywords: "avocado guacamole" },
  // Vegetables
  { icon: "🍅", keywords: "tomato" },
  { icon: "🥔", keywords: "potato spud" },
  { icon: "🍠", keywords: "sweet potato yam" },
  { icon: "🥕", keywords: "carrot" },
  { icon: "🧅", keywords: "onion shallot scallion leek" },
  { icon: "🧄", keywords: "garlic garlic powder" },
  { icon: "🫚", keywords: "ginger root turmeric" },
  { icon: "🌶️", keywords: "chili chile pepper hot jalapeno serrano habanero spicy" },
  { icon: "🫑", keywords: "bell pepper capsicum" },
  { icon: "🌽", keywords: "corn maize" },
  { icon: "🥦", keywords: "broccoli" },
  { icon: "🥬", keywords: "lettuce spinach kale cabbage greens salad arugula collard bok choy" },
  { icon: "🥒", keywords: "cucumber pickle zucchini courgette" },
  { icon: "🍄", keywords: "mushroom" },
  { icon: "🍆", keywords: "eggplant aubergine" },
  { icon: "🫛", keywords: "peas edamame snap peas green beans" },
  { icon: "🫘", keywords: "beans lentils chickpeas legume kidney black" },
  { icon: "🫒", keywords: "olives" },
  // Dairy & eggs
  { icon: "🥛", keywords: "milk dairy" },
  { icon: "🥚", keywords: "egg eggs" },
  { icon: "🧈", keywords: "butter margarine ghee" },
  { icon: "🧀", keywords: "cheese feta mozzarella cheddar parmesan gouda brie ricotta provolone swiss cottage queso" },
  { icon: "🍦", keywords: "ice cream gelato frozen dessert" },
  { icon: "mdi:cup-outline", keywords: "yogurt yoghurt creamer sour cream cottage cheese tub dairy" },
  // Bakery
  { icon: "🍞", keywords: "bread toast bagel bun roll loaf sandwich" },
  { icon: "🥖", keywords: "baguette sourdough french bread" },
  { icon: "🥐", keywords: "croissant pastry" },
  { icon: "🥨", keywords: "pretzel" },
  { icon: "🧇", keywords: "waffle" },
  { icon: "🥞", keywords: "pancake crepe" },
  { icon: "🍩", keywords: "donut doughnut" },
  { icon: "🍪", keywords: "cookie biscuit" },
  { icon: "🧁", keywords: "cupcake muffin" },
  { icon: "🍰", keywords: "cake dessert" },
  { icon: "🥧", keywords: "pie" },
  // Meat & seafood
  { icon: "🍗", keywords: "chicken poultry turkey drumstick wing" },
  { icon: "🥩", keywords: "beef steak mince ground beef meat" },
  { icon: "🥓", keywords: "bacon ham pork prosciutto" },
  { icon: "🌭", keywords: "sausage hot dog bratwurst frank kielbasa" },
  { icon: "🍖", keywords: "lamb ribs pork chop meat bone" },
  { icon: "🐟", keywords: "fish salmon tuna cod tilapia halibut trout" },
  { icon: "🍤", keywords: "shrimp prawn" },
  { icon: "🦀", keywords: "crab" },
  { icon: "🦞", keywords: "lobster" },
  { icon: "🦑", keywords: "squid calamari octopus" },
  { icon: "🦪", keywords: "oyster clam mussel scallop shellfish" },
  // Pantry & grains
  { icon: "🍚", keywords: "rice grain" },
  { icon: "🍜", keywords: "ramen udon soba noodle soup" },
  { icon: "🍝", keywords: "pasta spaghetti noodle macaroni penne lasagna" },
  { icon: "🥣", keywords: "cereal oats oatmeal granola muesli bowl porridge" },
  { icon: "🧂", keywords: "salt seasoning pepper" },
  { icon: "🍯", keywords: "honey syrup maple jam preserves molasses" },
  { icon: "🥜", keywords: "nuts peanut almond walnut cashew pistachio peanut butter" },
  { icon: "mdi:sack", keywords: "flour baking powder cornmeal grain bag" },
  { icon: "mdi:spoon-sugar", keywords: "sugar sweetener brown sugar powdered" },
  { icon: "mdi:shaker-outline", keywords: "spice cinnamon paprika cumin nutmeg seasoning oregano" },
  { icon: "mdi:bottle-tonic-outline", keywords: "oil olive vegetable canola vinegar dressing juice" },
  { icon: "mdi:soy-sauce", keywords: "sauce soy salsa ketchup mustard mayo gravy condiment soup broth stock canned" },
  // Snacks & sweets
  { icon: "🍟", keywords: "fries chips crisps" },
  { icon: "🍿", keywords: "popcorn" },
  { icon: "🍫", keywords: "chocolate cocoa candy bar" },
  { icon: "🍬", keywords: "candy sweets gummy lollipop gum mints" },
  { icon: "🍘", keywords: "crackers rice cracker" },
  // Drinks
  { icon: "☕", keywords: "coffee espresso latte" },
  { icon: "🍵", keywords: "tea green tea matcha" },
  { icon: "🧃", keywords: "juice box orange juice apple juice oj capri sun" },
  { icon: "🥤", keywords: "sports drink gatorade powerade electrolyte energy drink soda cup straw slushie" },
  { icon: "💧", keywords: "water" },
  { icon: "ic:waterbottle", keywords: "water bottle bottled water" },
  { icon: "ic:protein", keywords: "protein shake powder whey" },
  { icon: "mdi:bottle-soda-classic", keywords: "soda cola pop soft drink sparkling seltzer club soda tonic" },
  { icon: "🍷", keywords: "wine red white rose" },
  { icon: "🍺", keywords: "beer ale lager cider" },
  // Prepared / frozen / herbs
  { icon: "🍕", keywords: "pizza" },
  { icon: "🍣", keywords: "sushi sashimi" },
  { icon: "🥪", keywords: "sandwich sub deli" },
  { icon: "🥗", keywords: "salad" },
  { icon: "🌮", keywords: "taco" },
  { icon: "🌯", keywords: "burrito wrap" },
  { icon: "🥟", keywords: "dumpling gyoza potsticker wonton" },
  { icon: "🍱", keywords: "bento meal frozen dinner" },
  { icon: "🍛", keywords: "curry stew" },
  { icon: "🌿", keywords: "herbs basil parsley cilantro thyme rosemary oregano mint fresh" },
  // Household
  { icon: "🧻", keywords: "toilet paper tp bath tissue" },
  { icon: "ic:papertowel", keywords: "paper towel kitchen roll" },
  { icon: "ic:napkin", keywords: "napkin serviette" },
  { icon: "mdi:box", keywords: "tissues kleenex facial box carton foil wrap bags" },
  { icon: "mdi:spray-bottle", keywords: "detergent cleaner bleach sanitizer disinfectant spray cleaning" },
  { icon: "mdi:pump", keywords: "soap shampoo conditioner body wash hand soap dish soap lotion" },
  { icon: "🧽", keywords: "sponge scrubber dish" },
  { icon: "🪥", keywords: "toothbrush toothpaste floss dental" },
  { icon: "🔋", keywords: "battery batteries aa aaa" },
  { icon: "💡", keywords: "light bulb lightbulb lamp" },
  { icon: "🗑️", keywords: "trash garbage bin bags waste" },
  { icon: "👕", keywords: "shirt clothes clothing socks pants jacket underwear" },
  { icon: "👟", keywords: "shoes boots sneakers" },
  // Health, baby, pet, misc
  { icon: "💊", keywords: "medicine pills vitamin supplement magnesium melatonin probiotic omega fish oil advil tylenol aspirin" },
  { icon: "🩹", keywords: "bandage band aid first aid" },
  { icon: "mdi:diaper-outline", keywords: "diaper nappy wipes baby" },
  { icon: "🍼", keywords: "formula baby bottle infant" },
  { icon: "mdi:bowl-mix-outline", keywords: "pet dog cat food kibble treats litter" },
  { icon: "💐", keywords: "flowers bouquet plant" },
  { icon: "📦", keywords: "other misc box generic package" },
];

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
