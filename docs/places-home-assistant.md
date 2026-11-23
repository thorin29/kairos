# Family map — setup (Home Assistant and Google)

Family map (called Places in the code, URLs and Admin path `/admin/places`,
and before v0.766) shows where everyone is, using the locations the Home Assistant Companion
app already reports. Home Assistant posts each update to Kairos; Kairos keeps the
history and shows it. Kairos never gets a Home Assistant login.

Everything below uses placeholder names (`kairos.example.com`,
`person.alex`, `device_tracker.phone_a`, `192.168.1.10`). Use your own.

Only an admin can open Admin → Family map, change these settings or delete history.

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

1. Admin → Family map → **Make token**. Copy it right away — Kairos shows it once
   and keeps only a hash. **New token** replaces it (the old one stops working).
2. Admin → Family map → People: type each person's Home Assistant **person**
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
        "last_updated": updated | default(none),
        "zone": zone | default(none)
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
      zone: "{{ trigger.to_state.state }}"
```

- A state trigger with no `to:` fires on attribute changes too, so every new
  position is sent, not only zone changes.
- Speed, course and altitude come from the phone tracker behind the person;
  battery from that phone's Companion battery sensor
  (`device_tracker.phone_a` → `sensor.phone_a_battery_level`). If a phone has
  no such sensor, battery is just left blank.
- An update with no GPS position (a router-only tracker) is skipped.
- `zone` is the person's state: the Home Assistant zone they're in ("home",
  "Work", …) or `not_home`. Kairos names the place after the zone (before
  asking Google) and offers zones in notification rules, so Home Assistant's
  zone boundaries and home-network detection decide "Home". Without it,
  Kairos's own named places and saved addresses still work.

### 3d. Check it

1. Ask a phone for a fresh location: Developer tools → Actions → YAML mode:
   ```yaml
   action: notify.mobile_app_phone_a
   data:
     message: request_location_update
   ```
   → **Perform action**.
2. Admin → Family map → Status should read "Last location received …", and the
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
   (New)**, **Geocoding API**, **Roads API** and **Routes API** (road-following tracks).
5. **Map key** — APIs & Services → Credentials → **Create credentials → API
   key**. Edit it:
   - Name: Kairos map
   - Application restrictions: **Websites** → add `https://kairos.example.com/*`
     (and the LAN address you open Kairos at, if any, e.g.
     `http://192.168.1.10:8642/*`)
   - API restrictions: **Restrict key** → Maps JavaScript API
   - Save. Paste it into Admin → Family map → Map key.
6. **Lookup key** — Create credentials → API key again:
   - Name: Kairos lookups
   - Application restrictions: None (Kairos calls from your home connection,
     whose address can change; the API restriction and caps below protect it)
   - API restrictions: **Restrict key** → Places API (New), Geocoding API,
     Roads API, Routes API
   - Save. Paste it into Admin → Family map → Place lookup key.
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
   - Routes API: **Directions - ComputeRoutes per request quota per day**
     **300** (leave the per-minute and DistanceMatrix lines alone)
   A free-trial project can't change these; set them after upgrading. Kairos
   also stops itself at 140 place-name, 280 address, 140 road and 280 route
   lookups a day, and keeps each route request to 10 stops or fewer
   (Essentials pricing).
9. Admin → Family map → **Save keys**.

The map key is visible in the page by design; the website restriction is what
stops other sites from using it. The lookup key never leaves the server.

## Part 5 — Notifications (optional)

Admin → Family map → **Notifications**: tell (anyone) when someone (or anyone)
**arrives at** and/or **leaves** a place: a Home Assistant zone (follows
Home Assistant's own zone changes), or one of Kairos's named places (each with
a size you set under Named places) or saved addresses (by distance). "Arrived" needs a fix inside the place; "left" needs one 50 m
beyond it, so GPS wobble at the edge doesn't repeat; the same person and place
won't notify twice within 10 minutes; nobody is told about themselves.

Notifications reach phones through the Kairos app. For instant delivery the
server can use Firebase Cloud Messaging: Kairos sends only a content-free
"check your inbox" ping; the app then fetches the text from Kairos, so no
names or places pass through Google. Without Firebase the app checks for
them every 15 minutes.

Firebase setup (one time, free):
1. <https://console.firebase.google.com> → **Add project** (use the Google
   Cloud project you already have, or a new one).
2. Project settings → General → **Add app → Android**, package name
   `com.kairos.app`, register. Skip the config-file and SDK
   steps — Kairos sends these values to the app at runtime instead.
3. From Project settings → General copy the **Project ID**, **Project number**
   (Sender ID), and from the Android app the **App ID** and the **Web API key**
   (or the API key shown for the app). Paste them in Admin → Family map →
   Instant push.
4. Project settings → **Service accounts** → **Generate new private key** →
   paste the whole JSON file into **Service account key** → **Save**. It stays
   on the server.

## Part 6 — Places in the phone app

Places is in the app's menu once it's set up here (app 0.550+). It shows these
same pages, signed in through the phone itself, so nobody needs a web sign-in.
The map loads from the address the app is set to, so the **Kairos map** key's
website restrictions need that address (Part 4, step 5): add the LAN address
too if phones use it. Phones ask once for permission to show notifications.

If a sign-in portal (Authelia, Authentik, …) sits in front of Kairos, it must
let the app's Places pages through the same way it lets `/api/v1` through —
Kairos still locks those pages itself (the phone's 12-hour Places sign-in).
Authelia example:

```yaml
    - domain:
        - 'kairos.example.com'
      resources:
        - '^/api/v1([/?].*)?$'
        - '^/places/embed([/?].*)?$'
        - '^/_next/static/.*$'
        - '^/api/avatars/.*$'
      policy: 'bypass'
```

Without it the portal's sign-in page opens instead and the app says Places
was sent to another page.

## Notes

- Retries are safe: the same tracker and `last_updated` replace the earlier copy.
- A point with no GPS fix (0, 0) is refused.
- Place names, in order: the family's own names ("Not right?"), the Home
  Assistant zone (or within about 60 m of where phones usually report from
  inside it), a saved address within about 150 m, then Google — and when
  Google's street address is a saved address's, the saved name is used (a big
  venue's entrance can be far from its map pin). Google searches up to about
  150 m for a business, nearest first. Its answers are kept 30 days (Google's
  limit) and reused within about 30 m for a business and 25 m for a street
  address. Nobody moving is looked up. "Just the address" stops business
  names at a spot; it doesn't hide a zone.
- Wrong name? In Places, tap the person → **Not right?**: pick another nearby
  business, **Just the address**, or **Name this place…** (for everyone, or
  just that person — e.g. their own "Work"). The family's names always win and
  don't expire. Admin → Family map → Named places lists and removes them.
- Tracks: each finished drive is matched to the roads once and kept 30 days —
  snapped (Roads API) when the phone reported often, routed through the
  reports (Routes API) when there were long gaps. Either answer must pass
  within about 150 m of every report and fit the time taken, so off-road
  drives (trails, a Jeep track) and walks are drawn as recorded; walks are
  never sent to Google.
- People inside a Home Assistant zone are drawn at the zone's centre (learned
  from where phones report while in it), so everyone at home groups together.
- Admin → Family map → Status shows how many points are stored and how much space
  they take; Google usage shows the calls Kairos made today and this month,
  with links to Google's own usage, caps and billing pages. Delete history there (one person or everyone, optionally between
  two dates).
