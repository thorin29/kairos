# Places — setup (Home Assistant and Google)

Places shows where everyone is, using the locations the Home Assistant Companion
app already reports. Home Assistant posts each update to Kairos; Kairos keeps the
history and shows it. Kairos never gets a Home Assistant login.

Everything below uses placeholder names (`kairos.example.com`,
`person.alex`, `device_tracker.phone_a`, `192.168.1.10`). Use your own.

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
2. Admin → Places → People: type each person's Home Assistant **person**
   entity, like `person.alex`, and **Save people**. Leave a person blank to not
   track them.

Why person entities: Home Assistant decides which phone belongs to whom, so a
new phone is changed only in Home Assistant. A person entity carries the
location and accuracy, plus `source` — the phone tracker it came from — which
the automation reads for speed, course, altitude and battery.

Check each person first (Developer tools → States → `person.…`):
- `latitude`, `longitude`, `gps_accuracy` and `source` are present.
- `device_trackers` lists only the phone they carry. An extra tracker that
  stays home (an old phone, a tablet, the same phone registered twice) can
  win and pull the person back home. Remove extras under Settings → People →
  the person → Track device.

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

Every optional value has `| default(none)`, so a call that leaves one out
still sends valid JSON.

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
        "gps_accuracy": accuracy | default(none),
        "speed": speed | default(none),
        "course": course | default(none),
        "altitude": altitude | default(none),
        "battery": battery | default(none),
        "last_updated": updated | default(none)
      } | to_json }}
```

Then Developer tools → YAML → **Check configuration**, and restart Home
Assistant (Settings → System → Restart). A REST command only appears after a
restart.

### 3c. Add the automation

Settings → Automations & scenes → **Create automation** → **Create new
automation** → ⋮ (top right) → **Edit in YAML**. Replace everything with this,
put your person entities under `entity_id`, and **Save**:

```yaml
alias: Send locations to Kairos
mode: queued
max: 50
triggers:
  - trigger: state
    entity_id:
      - person.alex
      - person.sam
conditions:
  - condition: template
    value_template: "{{ trigger.to_state.attributes.latitude is defined }}"
actions:
  - variables:
      src: "{{ trigger.to_state.attributes.source | default('') }}"
  - action: rest_command.kairos_location
    data:
      tracker: "{{ trigger.entity_id }}"
      lat: "{{ trigger.to_state.attributes.latitude }}"
      lon: "{{ trigger.to_state.attributes.longitude }}"
      accuracy: "{{ trigger.to_state.attributes.gps_accuracy | default(none) }}"
      speed: "{{ state_attr(src, 'speed') if src else none }}"
      course: "{{ state_attr(src, 'course') if src else none }}"
      altitude: "{{ state_attr(src, 'altitude') if src else none }}"
      battery: "{{ states('sensor.' ~ src.split('.')[1] ~ '_battery_level') | int(none) if src else none }}"
      updated: "{{ trigger.to_state.last_updated.isoformat() }}"
```

- A state trigger with no `to:` fires on attribute changes too, so every new
  position is sent, not only zone changes.
- Speed, course and altitude come from the phone tracker behind the person;
  battery from that phone's Companion battery sensor
  (`device_tracker.phone_a` → `sensor.phone_a_battery_level`). If a phone has
  no such sensor, battery is just left blank.
- An update with no GPS position (a router-only tracker) is skipped.

### 3d. Check it

1. Ask a phone for a fresh location: Developer tools → Actions → YAML mode:
   ```yaml
   action: notify.mobile_app_phone_a
   data:
     message: request_location_update
   ```
   → **Perform action**.
2. Admin → Places → Status should read "Last location received …", and the
   person shows their last time, accuracy, battery and speed.

If nothing arrives, call the REST command by hand to see Kairos's answer
(Developer tools → Actions → YAML mode → **Perform action**; the response
shows underneath):

```yaml
action: rest_command.kairos_location
data:
  tracker: person.alex
  lat: "{{ state_attr('person.alex', 'latitude') }}"
  lon: "{{ state_attr('person.alex', 'longitude') }}"
  accuracy: "{{ state_attr('person.alex', 'gps_accuracy') }}"
  updated: "{{ now().isoformat() }}"
```

- `status: 200` with `"stored": 1` — working.
- `"skipped": ["person.alex"]` — that entity isn't saved under People.
- `status: 401` — the token in `secrets.yaml` doesn't match (it must be
  `"Bearer <token>"`, the newest token, and Home Assistant restarted after
  editing). Automation traces show the step as finished even on a 401, so
  test this way.
- An error with no response — wrong URL or port (Settings → System → Logs,
  search `rest_command`).
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
   (New)**, **Geocoding API**, **Roads API** (road-following tracks).
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
   - API restrictions: **Restrict key** → Places API (New), Geocoding API,
     Roads API
   - Save. Paste it into Admin → Places → Place lookup key.
7. **Map ID** — Google Maps Platform → **Map management → Create map ID**:
   name "Kairos", type **JavaScript**, **Vector**. Copy the Map ID into Admin →
   Places → Map ID.
8. **Daily caps** — Google Maps Platform → **Quotas**, pick each API, edit the
   per-day limit. These keep a whole month inside the free allowance
   (Essentials 10,000 a month, Pro 5,000; Nearby Search is Pro):
   - Maps JavaScript API: map loads per day **300**
   - Geocoding API: v3 requests per day **300**
   - Places API (New): Search Nearby requests per day **150** (if only
     per-minute limits are offered, leave them)
   - Roads API: requests per day **150**
   A free-trial project can't change these; set them after upgrading. Kairos
   also stops itself at 140 place-name, 280 address and 140 road lookups a
   day.
9. Admin → Places → **Save keys**.

The map key is visible in the page by design; the website restriction is what
stops other sites from using it. The lookup key never leaves the server.

## Notes

- Retries are safe: the same tracker and `last_updated` replace the earlier copy.
- A point with no GPS fix (0, 0) is refused.
- Place names: Kairos names a stop from a saved address within about 120 m
  first, then from Google. Google's answers are kept 30 days (Google's limit)
  and reused for anyone stopping within about 60 m, so the same spot isn't
  asked twice. Nobody moving is looked up.
- Wrong name? In Places, tap the person → **Not right?**: pick another nearby
  business, **Just the address**, or **Name this place…** (for everyone, or
  just that person — e.g. their own "Work"). The family's names always win and
  don't expire. Admin → Places → Named places lists and removes them.
- Tracks: each finished drive is snapped to the roads once (Roads API) and
  kept 30 days; drives that leave the road (trails, car parks) and walks are
  drawn as recorded.
- Admin → Places → Status shows how many points are stored and how much space
  they take; Google usage shows the calls Kairos made today and this month,
  with links to Google's own usage, caps and billing pages. Delete history there (one person or everyone, optionally between
  two dates).
