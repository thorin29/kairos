# Event background images

Drop image files here to give calendar items a background image (behind the
event block and in the detail popup). Everything degrades gracefully: if a file
is missing, the item just shows its colour — so you can add these one at a time.

## Format

- **File type:** JPG, named exactly as listed below (e.g. `birthday.jpg`).
- **Aspect / size:** **16:9**, generated at that ratio. Store at about
  **1280x720**. The event-detail banner shows the image at 16:9, so a 16:9
  file displays whole with no cropping — generate at 16:9 and it just fits.
- **Legibility:** don't worry about it — a dark scrim is layered over every
  image automatically and event text is white, so images stay readable.

## Files to create

Filename -> used for:

- `birthday.jpg` — birthdays
- `christmas.jpg` — Christmas Day and Christmas Eve
- `thanksgiving.jpg` — Thanksgiving and the day after
- `easter.jpg` — Easter, Good Friday, Palm Sunday
- `halloween.jpg` — Halloween
- `newyear.jpg` — New Year's Day and New Year's Eve
- `valentines.jpg` — Valentine's Day
- `independence.jpg` — Independence Day
- `stpatricks.jpg` — St. Patrick's Day
- `hockey.jpg` — an event type named "Hockey"
- `class.jpg` — class meetings (school)
- `church.jpg` — an event type named "Church"
- `appointment.jpg` — appointments
- `vacation.jpg` — event types "Vacation", "Trip", "Travel", and household pauses
- `default.jpg` — fallback for any holiday without its own image above

## Notes

- Composition tip: keep the main subject roughly centered with a little room
  on all sides. The image shows whole at 16:9, and tiny calendar chips crop to
  their center, so nothing critical should sit hard against an edge.
- Custom event types match by name, case-insensitively.
