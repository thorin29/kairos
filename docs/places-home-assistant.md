# Places — sending locations from Home Assistant

Places shows where everyone is, using the locations the Home Assistant Companion
app already reports. Home Assistant posts each update to Kairos; Kairos keeps the
history and shows it. Kairos never gets a Home Assistant login.

Everything below uses placeholder names. Use your own entity ids and address.

## 1. Make a token in Kairos

Admin → Places → **Make token**. Copy it right away: Kairos shows it once and
keeps only a hash. **New token** replaces it (the old one stops working).

## 2. Link people

Admin → Places → People: type each person's tracker entity, for example
`device_tracker.phone_a`, and **Save people**. Leave a person blank to not track
them. A tracker that sends a location before it's linked shows up under Status,
so you can copy its exact id.

## 3. Add the token to `secrets.yaml`

```yaml
kairos_places_auth: "Bearer PASTE_THE_TOKEN_HERE"
```

## 4. Add the REST command (`configuration.yaml`)

```yaml
rest_command:
  kairos_location:
    url: "https://kairos.example.com/api/v1/places/ingest"
    method: POST
    headers:
      Authorization: !secret kairos_places_auth
    content_type: "application/json"
    timeout: 15
    payload: >
      {{ {
        "entity_id": entity_id,
        "latitude": latitude,
        "longitude": longitude,
        "gps_accuracy": gps_accuracy,
        "speed": speed,
        "course": course,
        "altitude": altitude,
        "battery": battery,
        "last_updated": last_updated
      } | to_json }}
```

Restart Home Assistant (or reload YAML) so the command exists.

## 5. Add the automation

```yaml
alias: Send locations to Kairos
mode: queued
max: 50
triggers:
  - trigger: state
    entity_id:
      - device_tracker.phone_a
      - device_tracker.phone_b
conditions:
  - condition: template
    value_template: "{{ trigger.to_state.attributes.latitude is defined }}"
actions:
  - action: rest_command.kairos_location
    data:
      entity_id: "{{ trigger.entity_id }}"
      latitude: "{{ trigger.to_state.attributes.latitude }}"
      longitude: "{{ trigger.to_state.attributes.longitude }}"
      gps_accuracy: "{{ trigger.to_state.attributes.gps_accuracy | default(none) }}"
      speed: "{{ trigger.to_state.attributes.speed | default(none) }}"
      course: "{{ trigger.to_state.attributes.course | default(none) }}"
      altitude: "{{ trigger.to_state.attributes.altitude | default(none) }}"
      battery: "{{ trigger.to_state.attributes.battery_level | default(none) }}"
      last_updated: "{{ trigger.to_state.last_updated.isoformat() }}"
```

A state trigger with no `to:` fires on attribute changes too, so every new
position is sent, not only zone changes. Add each person's tracker to
`entity_id`.

## 6. Check it

Admin → Places → Status should read "Last location received …" within a few
minutes, and each linked person shows their last time, accuracy, battery and
speed.

- **Nothing arrives:** check the URL and that the secret starts with `Bearer `.
  Home Assistant logs a failed `rest_command` under Settings → System → Logs.
- **"isn't linked to anyone":** the entity under Status doesn't match a person's
  entity in People.
- **Speed:** Kairos stores it as Home Assistant sends it. Compare the number
  under People with a known drive before trusting the unit.

## Notes

- Retries are safe: the same tracker and `last_updated` replace the earlier copy.
- A point with no GPS fix (0, 0) is refused.
- Delete history any time under Admin → Places → Delete history (one person or
  everyone, optionally between two dates).
