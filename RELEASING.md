# Releasing Kairos (Android)

The app updates itself from **GitHub Releases**. Publishing a Release is what
makes an update go live to the household; the in-app updater checks GitHub,
notices the newer `versionCode`, and offers a one-tap install.

Publishing is deliberate — it happens only on a version **tag** or a manual
run, never on an ordinary push. Your normal `main` push build (`android.yml`)
is unchanged and is still just for your own testing.

## Cut a release

1. **Bump the version** in `app/build.gradle.kts`:
   - `versionCode` — the integer Android compares; **must increase every release**.
   - `versionName` — the human version (e.g. `0.126.0`, or `1.0.0` at launch).
   - `CLIENT_BUILD` in `SessionRepository.kt` — **set it equal to `versionCode`**,
     every release. It is what the server's `minClient` gate compares, so a stale
     value would let the server lock out (or wave through) the wrong builds the
     day that gate is used. It drifted to 430 while `versionCode` reached 445
     and was put back in 0.389.0 (446).
2. **Update `CHANGELOG.md`** — add a `## <versionName>` section at the top. Its
   bullets become the release notes the household sees in the update prompt, so
   write them for the people using the app:
   - 1–4 bullets, one short line each — what changed, not why or how.
   - No instructions, explanations, server/deploy notes ("Needs web …") or
     internals (CLIENT_BUILD, refactors). Those belong in `DECISIONS.md`.
   - Example: `- Kairos icon now shows full size in "Open with" and share menus.`
3. **Update the docs that changed with the code** — `DECISIONS.md` for a new
   guardrail or a settled model, `ARCHITECTURE.md` for anything cross-cutting
   (stack, theming, navigation, a shared data model), and the web repo's
   `docs/API.md` if the contract moved. Treat this as part of the release.
   If you touched `NoteField.kt` or `IcsImport.kt`, run the web repo's
   `scripts/ics-parity/check.sh` against this clone.
4. **Check the Kotlin you changed.** Run `python3 scripts/check-positional-args.py
   app/src/main/java | grep -c "positional of"`. The count (237 at 0.501.0 and still 237 at 0.586.2)
   must not rise, so use named arguments. CI's Gradle build is the real
   compile.
5. **Commit.**
6. **Publish**, either:
   - `git tag v0.126.0 && git push origin v0.126.0`, or
   - Actions → **Release** → *Run workflow*.

The **Release** workflow builds the signed APK and publishes a GitHub Release
tagged `v<versionName>`, with two assets:

- `kairos-<versionName>.apk` — the signed app.
- `latest.json` — `{ versionCode, versionName, notes }`, which the app reads to
  decide whether to offer an update.

The APK is signed with the same key as always, so updates install **in place**
(no reinstall, no data loss).

## Notes

- Re-running for an existing tag refreshes the assets in place (`--clobber`).
- The publish step retries GitHub errors and always ends by publishing the
  release (`--draft=false`), so a failed run's leftover draft doesn't hide the
  update (0.573.0).
- This is independent of how signing is wired on push builds. If you ever move
  signing off the push build (so the key is only used at release time), this
  workflow is its natural home — but that's an optional, separate decision.
- Keep the signing keystore backed up **off GitHub**. If it's ever lost, no
  future build can update an installed copy in place.
