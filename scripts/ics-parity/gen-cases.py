#!/usr/bin/env python3
"""Seeded random .ics files for the parity check — mixes of the shapes the
hand-written cases cover, so the two parsers are compared well past them.
Usage: gen-cases.py <out-dir> [count] [seed]"""
import os, random, sys

out = sys.argv[1]
count = int(sys.argv[2]) if len(sys.argv) > 2 else 2000
rnd = random.Random(int(sys.argv[3]) if len(sys.argv) > 3 else 1)
os.makedirs(out, exist_ok=True)

ZONES = ["America/Chicago", "America/New_York", "Europe/London", "Asia/Tokyo",
         "Australia/Lord_Howe", "Central Standard Time", "Pacific Standard Time",
         "/mozilla.org/x/America/Denver", "Not A Zone", "UTC", "Etc/GMT+5", ""]
WORDS = ["Dentist", "Practice", "Flight", "Review", "Café", "a\\,b", "x\\;y",
         "line\\nbreak", "  pad  ", " nb", "\\\\slash", "\t", "🎉", "\\N"]
RULES = ["", "FREQ=DAILY", "FREQ=WEEKLY", "FREQ=MONTHLY", "FREQ=YEARLY",
         "FREQ=WEEKLY;BYDAY={dow}", "FREQ=WEEKLY;BYDAY=MO,WE", "FREQ=DAILY;COUNT=3",
         "FREQ=WEEKLY;INTERVAL=1", "FREQ=WEEKLY;INTERVAL=2", "FREQ=MONTHLY;BYMONTHDAY={dom}",
         "FREQ=YEARLY;BYMONTH={mon};BYMONTHDAY={dom}", "FREQ=HOURLY", "freq=weekly;wkst=mo",
         "FREQ=MONTHLY;BYMONTHDAY=0{dom}", "FREQ=WEEKLY;UNTIL=20271231T000000Z"]
DOWS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"]

def dt(allday):
    y = rnd.choice([2026, 2027, 2026, 1899 + rnd.randint(0, 2), 2199 + rnd.randint(0, 1), 999 + rnd.randint(0, 2)])
    mo = rnd.randint(1, 12) if rnd.random() > 0.03 else 13
    d = rnd.randint(1, 31)
    if allday:
        return f"{y:04d}{mo:02d}{d:02d}", (y, mo, d)
    h = rnd.choice([0, 1, 2, 3, 9, 12, 17, 22, 23, 24 if rnd.random() < 0.02 else 23])
    mi = rnd.choice([0, 15, 30, 45, 59, 7])
    s = rnd.choice(["", "00", "30"])
    z = "Z" if rnd.random() < 0.3 else ""
    return f"{y:04d}{mo:02d}{d:02d}T{h:02d}{mi:02d}{s}{z}", (y, mo, d)

def prop(name, allday):
    v, ymd = dt(allday)
    params = ""
    if allday and rnd.random() < 0.7:
        params += ";VALUE=DATE"
    if not allday and not v.endswith("Z") and rnd.random() < 0.7:
        tz = rnd.choice(ZONES)
        if tz:
            params += f';TZID="{tz}"' if rnd.random() < 0.2 else f";TZID={tz}"
    return f"{name}{params}:{v}", ymd

def event(uid):
    allday = rnd.random() < 0.3
    lines = ["BEGIN:VEVENT"]
    if uid is not None:
        lines.append(f"UID:{uid}")
    start, ymd = prop("DTSTART", allday)
    if rnd.random() > 0.03:
        lines.append(start)
    r = rnd.random()
    if r < 0.6:
        lines.append(prop("DTEND", allday if rnd.random() > 0.1 else not allday)[0])
    elif r < 0.8:
        lines.append("DURATION:" + rnd.choice(["PT1H", "PT1H30M", "P1D", "P3D", "-PT30M", "P1W", "PT0S", "bogus", "PT45M10S"]))
    lines.append("SUMMARY:" + " ".join(rnd.choice(WORDS) for _ in range(rnd.randint(0, 6))))
    if rnd.random() < 0.5:
        lines.append("LOCATION:" + " ".join(rnd.choice(WORDS) for _ in range(rnd.randint(0, 4))))
    if rnd.random() < 0.5:
        lines.append("DESCRIPTION:" + " ".join(rnd.choice(WORDS) for _ in range(rnd.randint(0, 120))))
    rule = rnd.choice(RULES)
    if rule:
        y, mo, d = ymd
        import datetime
        try:
            dow = DOWS[(datetime.date(y, mo, d).weekday() + 1) % 7]
        except Exception:
            dow = "MO"
        lines.append("RRULE:" + rule.format(dow=dow, dom=d, mon=mo))
    if rnd.random() < 0.05:
        lines.append("EXDATE:20261109T160000Z")
    if rnd.random() < 0.05:
        lines.append("STATUS:CANCELLED")
    if rnd.random() < 0.2:
        lines += ["BEGIN:VALARM", "DESCRIPTION:alarm text", "TRIGGER:-PT10M", "END:VALARM"]
    lines.append("END:VEVENT")
    return lines

for i in range(count):
    body = ["BEGIN:VCALENDAR", "VERSION:2.0"]
    if rnd.random() < 0.1:
        body.append("METHOD:" + rnd.choice(["REQUEST", "CANCEL", "PUBLISH"]))
    n = rnd.choice([0, 1, 1, 1, 1, 1, 2, 3])
    uids = [rnd.choice(["u1", "u2", None, "u1"]) for _ in range(n)]
    for u in uids:
        body += event(u)
    if n == 1 and rnd.random() < 0.15:
        ov = event(uids[0])
        ov.insert(1, "RECURRENCE-ID:20261109T160000Z")
        body += ov
    body.append("END:VCALENDAR")
    sep = rnd.choice(["\r\n", "\n", "\r"])
    text = sep.join(body) + sep
    if rnd.random() < 0.2:  # fold some long lines
        text = text.replace("DESCRIPTION:", "DESCRIPTION:" + sep + " ", 1)
    if rnd.random() < 0.05:
        text = "﻿" + text
    with open(os.path.join(out, f"gen-{i:05d}.ics"), "w", encoding="utf-8", newline="") as f:
        f.write(text)
