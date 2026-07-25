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
  [/\bapples?\b/, "🍎"],
  [/\bbananas?\b/, "🍌"],
  [/\boranges?\b/, "🍊"],
  [/\blemons?|limes?\b/, "🍋"],
  [/\bstrawberr/, "🍓"],
  [/\bgrapes?\b/, "🍇"],
  [/\bwatermelon|melon\b/, "🍉"],
  [/\bberr(y|ies)\b/, "🫐"],
  [/\bavocado/, "🥑"],
  [/\btomato/, "🍅"],
  [/\bpotato/, "🥔"],
  [/\bcarrots?\b/, "🥕"],
  [/\bonions?\b/, "🧅"],
  [/\bgarlic\b/, "🧄"],
  [/\bpeppers?\b/, "🫑"],
  [/\bcorn\b/, "🌽"],
  [/\bbroccoli|lettuce|spinach|kale|greens?\b/, "🥬"],
  [/\bcucumber|pickles?\b/, "🥒"],
  [/\bmushroom/, "🍄"],
  [/\bmilk\b/, "🥛"],
  [/\begg/, "🥚"],
  [/\bbutter\b/, "🧈"],
  [/\bcheese\b/, "🧀"],
  [/\byogh?urt\b/, "🥛"],
  [/\bbread|bagel|bun|roll\b/, "🍞"],
  [/\bcroissant\b/, "🥐"],
  [/\bchicken|poultry|turkey\b/, "🍗"],
  [/\bbeef|steak|mince\b/, "🥩"],
  [/\bbacon\b/, "🥓"],
  [/\bfish|salmon|tuna\b/, "🐟"],
  [/\bshrimp|prawn/, "🍤"],
  [/\brice\b/, "🍚"],
  [/\bpasta|spaghetti|noodle/, "🍝"],
  [/\bcereal|oats|granola\b/, "🥣"],
  [/\bflour\b/, "🌾"],
  [/\bsugar\b/, "🍬"],
  [/\bsalt\b/, "🧂"],
  [/\bhoney\b/, "🍯"],
  [/\boil\b/, "🫒"],
  [/\bcoffee\b/, "☕"],
  [/\btea\b/, "🍵"],
  [/\bjuice\b/, "🧃"],
  [/\bwater\b/, "💧"],
  [/\bwine\b/, "🍷"],
  [/\bbeer\b/, "🍺"],
  [/\bsoda|cola|pop\b/, "🥤"],
  [/\bchocolate\b/, "🍫"],
  [/\bcookie|biscuit\b/, "🍪"],
  [/\bcake\b/, "🍰"],
  [/\bice cream\b/, "🍦"],
  [/\bchips|crisps\b/, "🍟"],
  [/\bpopcorn\b/, "🍿"],
  [/\bnuts?|almond|peanut\b/, "🥜"],
  [/\bbeans?\b/, "🫘"],
  [/\bsoup\b/, "🥫"],
  [/\bpizza\b/, "🍕"],
  [/\btoilet paper|paper towel|tissue|napkin/, "🧻"],
  [/\bsoap|detergent|shampoo|cleaner\b/, "🧼"],
  [/\btoothpaste|toothbrush\b/, "🪥"],
  [/\bbatter(y|ies)\b/, "🔋"],
  [/\bshirt|clothes|clothing|socks|pants|jacket\b/, "👕"],
  [/\bshoes|boots\b/, "👟"],
  [/\bmedicine|pills?|vitamins?\b/, "💊"],
  [/\bdiaper|nappy\b/, "🧷"],
  [/\bflowers?\b/, "💐"],
  [/\blight ?bulb|bulb\b/, "💡"],
];

export function guessIcon(name: string): string {
  const n = name.toLowerCase();
  for (const [re, icon] of ICONS) if (re.test(n)) return icon;
  return "📦";
}
