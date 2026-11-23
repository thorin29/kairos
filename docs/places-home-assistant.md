# Places — setup (Home Assistant and Google)

Places shows where everyone is, using the locations the Home Assistant Companion
app already reports. Home Assistant posts each update to Kairos; Kairos keeps the
history and shows it. Kairos never gets a Home Assistant login.

Everything below uses placeholder names (`kairos.example.com`,
`device_tracker.phone_a`, `192.168.1.10`). Use your own.

Only an admin can open Admin → Places, change these settings or delete history.

---

## Part 1 — Phones

On every phone that should be tracked:

1. The Home Assistant Companion app is installed and signed in.
2. Android settings → Apps → Home Assistant → Permissions → Location →
   **Allow all the time**, and **Use precise location** on.
3. Companion app → Settings → Companion app → Manage sensors → **Background
   location** on. (Optional: **High accuracy mode** gives tighter paths at
   some battery cost.)
4. Android settings → Apps → Home Assistant → Battery → **Unrestricted**, so
   Android doesn't pause it.

## Part 2 — Kairos

1. Admin → Places → **Make token**. Copy it right away — Kairos shows it once
   and keeps only a hash. **New token** replaces it (the old one stops working).
2. Find each phone's tracker in Home Assistant: Settings → Devices & services →
   Entities, search `device_tracker`. Each Companion phone has one, like
   `device_tracker.phone_a`.
3. Admin → Places → People: type each person's tracker and **Save people**.
   Leave a person blank to not track them.

## Part 3 — Home Assistant

### 3a. Add the token to `secrets.yaml`

`secrets.yaml` sits next to `configuration.yaml` in the Home Assistant config
folder (Home Assistant OS: the File editor or Studio Code Server add-on; Docker:
the container's mapped `/config` folder). Add, keeping the word `Bearer` and the
space:

```yaml
kairos_places_auth: "Bearer PASTE_THE_TOKEN_HERE"
```

### 3b. Add the REST command to `configuration.yaml`

If `configuration.yaml` already has a `rest_command:` line, put `kairos_location:`
under that one instead of adding a second `rest_command:`.

Pick the URL:
- **Same network (recommended when Home Assistant and Kairos run on the same
  server or LAN):** `http://192.168.1.10:8642/api/v1/places/ingest` — the
  server's LAN address and Kairos's web port. Stays off the internet and away
  from any proxy or bot filter.
- **Public address:** `https://kairos.example.com/api/v1/places/ingest`. If a
  CDN/WAF sits in front (bot protection, an SSO gateway), let
  `/api/v1/places/ingest` through, or Home Assistant's requests get blocked.

```yaml
rest_command:
  kairos_location:
    url: "http://192.168.1.10:8642/api/v1/places/ingest"
    method: POST
    headers:
      Authorization: !secret kairos_places_auth
    content_type: "application/json"
    timeout: 15
    payload: >
      {{ {
        "entity_id": tracker,
        "latitude": lat,
        "longitude": lon,
        "gps_accuracy": accuracy,
        "speed": speed,
        "course": course,
        "altitude": altitude,
        "battery": battery,
        "last_updated": updated
      } | to_json }}
```

Then Developer tools → YAML → **Check configuration**, and restart Home
Assistant (Settings → System → Restart). A REST command only appears after a
restart.

### 3c. Add the automation

Settings → Automations & scenes → **Create automation** → **Create new
automation** → ⋮ (top right) → **Edit in YAML**. Replace everything with this,
put your trackers under `entity_id`, and **Save**:

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
      tracker: "{{ trigger.entity_id }}"
      lat: "{{ trigger.to_state.attributes.latitude }}"
      lon: "{{ trigger.to_state.attributes.longitude }}"
      accuracy: "{{ trigger.to_state.attributes.gps_accuracy | default(none) }}"
      speed: "{{ trigger.to_state.attributes.speed | default(none) }}"
      course: "{{ trigger.to_state.attributes.course | default(none) }}"
      altitude: "{{ trigger.to_state.attributes.altitude | default(none) }}"
      battery: "{{ trigger.to_state.attributes.battery_level | default(none) }}"
      updated: "{{ trigger.to_state.last_updated.isoformat() }}"
```

A state trigger with no `to:` fires on attribute changes too, so every new
position is sent, not only zone changes.

### 3d. Check it

1. Ask a phone for a fresh location: Developer tools → Actions → pick
   `notify.mobile_app_<phone>` → YAML mode → `message: request_location_update`
   → **Perform action**. (Or just walk outside with the phone for a minute.)
2. Admin → Places → Status should read "Last location received …", and the
   person shows their last time, accuracy, battery and speed.

If nothing arrives:
- Settings → Automations → **Send locations to Kairos** → ⋮ → **Traces**: did it
  run, and did the REST command step fail?
- Settings → System → Logs, search `rest_command`. `401` = token wrong (check
  `Bearer ` is in the secret); a timeout or connection error = wrong URL or port.
- Status says a tracker "isn't linked to anyone": copy that id into People.
- Speed is stored as Home Assistant sends it. Compare the number under People
  with a known drive before trusting its unit.

## Part 4 — Google (for the map and place names)

Google Maps Platform needs a Google Cloud project with billing turned on. Its
monthly free usage covers a household; a budget alert and daily caps keep it
that way.

1. <https://console.cloud.google.com> → project picker → **New project**
   (e.g. "Kairos Places") → Create, and select it.
2. **Billing** → link a billing account (add a card if asked).
3. **Billing → Budgets & alerts → Create budget**: amount $1, alerts at
   50/90/100%.
4. **APIs & Services → Library**, enable: **Maps JavaScript API**, **Places API
   (New)**, **Geocoding API**.
5. **Map key** — APIs & Services → Credentials → **Create credentials → API
   key**. Edit it:
   - Name: Kairos map
   - Application restrictions: **Websites** → add `https://kairos.example.com/*`
     (and the LAN address you open Kairos at, if any, e.g.
     `http://192.168.1.10:8642/*`)
   - API restrictions: **Restrict key** → Maps JavaScript API
   - Save. Paste it into Admin → Places → Map key.
6. **Lookup key** — Create credentials → API key again:
   - Name: Kairos lookups
   - Application restrictions: None (Kairos calls from your home connection,
     whose address can change; the API restriction and caps below protect it)
   - API restrictions: **Restrict key** → Places API (New), Geocoding API
   - Save. Paste it into Admin → Places → Place lookup key.
7. **Map ID** — Google Maps Platform → **Map management → Create map ID**:
   name "Kairos", type **JavaScript**, **Vector**. Copy the Map ID into Admin →
   Places → Map ID.
8. **Daily caps** — APIs & Services → each of Places API (New) and Geocoding API
   → **Quotas & system limits** → set requests per day to 500. Maps JavaScript
   API map loads: 300 per day.
9. Admin → Places → **Save keys**.

The map key is visible in the page by design; the website restriction is what
stops other sites from using it. The lookup key never leaves the server.

## Notes

- Retries are safe: the same tracker and `last_updated` replace the earlier copy.
- A point with no GPS fix (0, 0) is refused.
- Admin → Places → Status shows how many points are stored and how much space
  they take. Delete history there (one person or everyone, optionally between
  two dates).
