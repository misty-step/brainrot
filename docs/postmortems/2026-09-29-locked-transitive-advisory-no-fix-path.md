# Postmortem: Security update failing silently with no fix path (brainrot)

- **Incident date:** 2026-09-29
- **Status:** Closed by the change that adds the `advisories` lane (`pnpm advisories:check`) to the required CI gate
- **Operational owner:** Phaedrus
- **Tracker:** Linear MIS-191 (second repo with this class after MIS-186 and MIS-187 on misty-step/misty-step)

## Summary

Dependabot's security update for `ip-address` failed on `master`
([run 36608480884](https://github.com/misty-step/brainrot/actions/runs/36608480884),
17:57 UTC) with `security_update_not_possible`, `latest-resolvable-version`
10.1.0 and an empty `conflicting-dependencies` list. The class of error: a
vulnerable version that is only a locked transitive dependency has no automated
fix path, so its advisory stays open with no pull request and nothing in the
build notices. The same job had failed for `ip-address` on 2026-09-16
([run 35068288792](https://github.com/misty-step/brainrot/actions/runs/35068288792)),
and the `undici` and `brace-expansion` jobs failed on both dates. This is the
class recorded in the misty-step/misty-step postmortems
[locked transitive advisory with no fix path](https://github.com/misty-step/misty-step/blob/master/docs/postmortems/2026-09-28-locked-transitive-advisory-no-fix-path.md)
(MIS-186) and
[a dependency fix that breaks Dependabot](https://github.com/misty-step/misty-step/blob/master/docs/postmortems/2026-09-29-dependabot-lockfile-release-age.md)
(MIS-187).

## Impact

Observed:

- The locked tree pinned `ip-address@10.1.0`, affected by three advisories:
  GHSA-v2v4-37r5-5v8g (medium, fixed 10.1.1, alert 98 open since 2026-05-07),
  GHSA-mwp4-54f8-5fhr (high, fixed 10.3.1, alert 191 since 2026-08-05) and
  GHSA-rpw4-54j3-4h4q (medium, fixed 10.5.1, alert 219 created 2026-09-29
  17:56 UTC, the alert that triggered run 36608480884). All three are on
  `pnpm-lock.yaml`. `content/translations/package-lock.json` does not contain
  `ip-address`, so the second directory in the job title needed no change.
- The only path is `apps/web` (dev dependency `puppeteer@24.32.0`) >
  `@puppeteer/browsers` > `proxy-agent` > `socks-proxy-agent` > `socks@2.8.7`
  > `ip-address`. `socks@2.8.7` declares `ip-address: ^10.0.1`, so 10.7.2 was
  > already permitted; the lockfile alone held it at 10.1.0.
- `pnpm audit` on the pre-fix lockfile listed 74 advisory records (64 distinct
  advisory/package pairs) across the whole tree. Sixty-one pairs, none for
  `ip-address`, remain after this change (see Follow-up).

Exposure, inferred from the code, not a runtime test: not exposed.

- `puppeteer` is only a `devDependency` of `apps/web`, imported by one manual
  script (`apps/web/scripts/testAudioPlayback.ts`); nothing shipped to the site
  imports it. GitHub's alert scope for these alerts is `development`.
- Even when that script runs, `socks` uses `Address4` and `Address6` only to
  parse or format a proxy address (`build/common/helpers.js`,
  `build/client/socksclient.js`: constructors and `canonicalForm()`). The
  advisories need `Address4` leading-zero octets or `isLinkLocal()` used for a
  trust decision, or `Address6.group()`, `.link()` and `parseMessage` rendered
  as HTML. None of those methods are called.

## Timeline

| Time (UTC)       | Observation                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| 2026-05-07       | Alert 98 (`ip-address` XSS) created.                                         |
| 2026-08-05       | Alert 191 (`ip-address` leading-zero SSRF) created.                          |
| 2026-09-16 07:18 | `ip-address`, `undici`, `brace-expansion` security jobs fail; nothing opens. |
| 2026-09-29 17:56 | Alert 219 (`ip-address` link-local) created; the security job fails again.   |
| 2026-09-29 18:02 | The alert intake opens MIS-191.                                              |

## Evidence and mechanism

- Reproduced locally with the command Dependabot ran in the job log
  (`pnpm update ip-address@10.7.2 --lockfile-only --no-save -r`, pnpm 8.15.1):
  it exits 0 and leaves `ip-address@10.1.0` in the lockfile. pnpm treats the
  lockfile pin as satisfying the request.
- Nothing in `.github/workflows/ci.yml` or `scripts/ci-required.sh` consulted
  an advisory source, so a red Dependabot job and open alerts were the only
  signals, and neither blocks or is read by a build.
- Lessons from MIS-187 that shaped the fix, checked against this repo's log:
  - Dependabot ran pnpm 8.15.1 (from `packageManager`) with no
    `--config.minimumReleaseAge` flag. pnpm 8 has no release-age setting, so the
    MIS-187 lockfile and release-age failure cannot occur here, and an
    `.npmrc` `minimum-release-age` would be ignored. None was added.
  - The fix was checked with Dependabot's own command on the fixed lockfile,
    not assumed: `pnpm update ip-address@10.7.2`, `prettier` and `tsx`
    (`--lockfile-only --no-save -r`) all exit 0. The lockfile diff is three
    lines: the override, `ip-address@10.7.2` (published 2026-09-15, older than
    three days), and its one dependent entry.

The failure is not the version. It is that the toolchain lets a known-vulnerable
locked version persist without either a fix or a failing check.

## Pokayoke

How can we pokayoke this so this kind of error never happens again?

Mechanism in this repository: a failing-closed check. `pnpm advisories:check`
(`scripts/check-dependency-advisories.ts`) runs `pnpm audit --json` and is the
`advisories` lane of `scripts/ci-required.sh`. The `advisories` job in
`.github/workflows/ci.yml` is a `needs` of `merge-gate`, the required status
check on `master`, so a new advisory blocks the merge. It fails when:

- an advisory in the locked tree is absent from
  `scripts/dependency-advisories-baseline.json` (it prints package, dependency
  path, patched range and the fix path);
- a baselined advisory no longer applies, so the baseline can only shrink;
- the audit response is missing or unparseable, so an unreachable or changed
  endpoint cannot pass.

The baseline exists because 61 other advisory/package pairs are already open;
a check that failed on all of them could not be enabled without a large
unrelated change. It is a ratchet over existing debt, not a waiver: the three
`ip-address` advisories are fixed, not baselined.

Proof the original path is closed: against the pre-fix lockfile the check exits
1 listing all three `ip-address` advisories with the `puppeteer > ... > socks`
path; against the fixed lockfile it exits 0.
`scripts/check-dependency-advisories.test.ts` rejects a report shaped like the
MIS-191 advisory, rejects a stale baseline entry and rejects an unrecognised
report.

Across Misty Step repositories: this is the third repository with a gate of
this shape (misty-step/misty-step `advisories:check` and linejam's
`scripts/ci/osv-audit.mjs` are the others). Of the 17 non-archived, non-fork
Misty Step repositories that hold a lockfile (survey of `gh api .../git/trees`
on 2026-09-29; two are an archive and a fixture, and misty-step/misty-step,
linejam and brainrot have a gate), 12 still have no advisory check: scry,
parlor, double-take, pantry, cantrip, sploot, kindred, landmark, waymark,
vibe-machine, poppycock
and polymorph. A per-repository script does not stop the class in those
repositories, and this postmortem does not claim it does. What removes it
across the organisation is an obligation, not another copy: the foundation
standard should require every repository with a lockfile to run a fail-closed
advisory check in its blocking gate, and `foundation-check` should report the
missing gate. Adding an obligation needs Phaedrus's approval (ADR-006), so it is
proposed here and not applied.

Residual classes still possible, not error-proofed:

- A new advisory published between merges fails the next unrelated build until
  someone adds an override. That is the intended trade for a fail-closed check.
- The 61 baselined pairs may still fail their Dependabot security jobs and can
  still page the alert intake when Dependabot re-evaluates them; the `undici`
  and `brace-expansion` jobs were already failing on 2026-09-16.
- `content/translations/package-lock.json` is an npm lockfile inside a pnpm
  workspace; `pnpm audit` does not read it, so its open alerts (`form-data`,
  `esbuild`) are outside the check.
- MIS-187 class: if `packageManager` is raised to pnpm 10.16 or newer,
  Dependabot starts passing `--config.minimumReleaseAge=4320`, and a lockfile
  pin younger than three days breaks every update. Brainrot has no
  `dependabot:check` for that; the reference is
  `scripts/check-dependabot-resolvable.mjs` and `.npmrc` in misty-step/misty-step,
  to be adopted in the same change that raises pnpm.

## Follow-up

- Fixed in the change that adds this file: `ip-address` override `^10.5.1` in
  `package.json`, in-range lockfile refresh (`ip-address` 10.1.0 to 10.7.2), the
  `advisories` lane and its regression test, and the baseline of 61 remaining
  pairs.
- Post-merge Dependabot re-runs are recorded on MIS-191.
- Owner Phaedrus: decide the foundation obligation above, and whether to clear
  the baseline (`undici`, `fast-uri`, `brace-expansion`, `minimatch` and others,
  mostly through `jsdom`, `cheerio`, `puppeteer` and `@aws-sdk/*`).
- See also the MIS-186 and MIS-187 postmortems linked in the Summary.
