# Event background images

Drop image files here to give calendar items a background image (behind the
event block and in the detail popup). Everything degrades gracefully: if a file
is missing, the item just shows its colour — so you can add these one at a time.

## Format

- **File type:** JPG, named exactly as listed below (e.g. `birthday.jpg`).
- **Size:** about **1200×400** (wide banner). Landscape.
- **Legibility:** don't worry about it — a dark scrim is layered over every
  image automatically, and event text is white, so even bright images stay
  readable. Busier/brighter images just get a slightly darker scrim.

## Files to create

Filename → used for:

- `birthday.jpg` — birthdays
- `christmas.jpg` — Christmas Day and Christmas Eve
- `thanksgiving.jpg` — Thanksgiving and the day after
- `easter.jpg` — Easter, Good Friday, Palm Sunday
- `halloween.jpg` — Halloween
- `newyear.jpg` — New Year's Day and New Year's Eve
- `valentines.jpg` — Valentine's Day
- `independence.jpg` — Independence Day
- `stpatricks.jpg` — St. Patrick's Day
- `hockey.jpg` — hockey events (an event type named "Hockey")
- `class.jpg` — class meetings (school)
- `church.jpg` — an event type named "Church"
- `appointment.jpg` — appointments
- `vacation.jpg` — an event type named "Vacation", "Trip", or "Travel"
- `default.jpg` — fallback for any holiday without its own image above

## Notes

- Holidays without a specific file (e.g. Memorial Day, MLK Day) use
  `default.jpg` if present, otherwise just their colour.
- Regular events only get a background when their kind/type matches one of the
  keys above; anything else shows colour only.
- Custom event types match by name, case-insensitively (so an event type called
  "Hockey" uses `hockey.jpg`). Game-vs-practice or per-event images can be added
  later.
