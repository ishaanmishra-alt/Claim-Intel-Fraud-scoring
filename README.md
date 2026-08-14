# Claim Intel — Interactive Prototype

Standalone fraud-risk scoring prototype for motor insurance claims (Middle East sample data). Front-end only; all behaviour runs against in-memory mock data.

## Run locally

Serve the folder over HTTP (ES modules require a local server):

```bash
cd claim-intel
python3 -m http.server 5173
```

Open [http://localhost:5173](http://localhost:5173).

## Shareable web version

A deployable package is in `dist/`:

| File | Use |
|---|---|
| `dist/site/` | Multi-file site — drag this folder onto [Netlify Drop](https://app.netlify.com/drop) |
| `dist/claim-intel.zip` | Same site, zipped |
| `dist/index.html` | Single-file build (also droppable on Netlify) |

After drop, Netlify gives a public URL you can share (e.g. `https://….netlify.app`).

## Demo logins

| Persona | Username | Password | Lands on |
|---|---|---|---|
| Claim User | `claim.user` | `demo123` | Claims queue |
| Claim Head | `claim.head` | `demo123` | Claims queue (Dashboard + Report available) |
| Admin | `admin` | `demo123` | Dashboard |
| FIU | `fiu` | `demo123` | Dashboard (same access as Admin) |
| Surveyor | `surveyor` | `demo123` | Claims queue (all stages; opens on Surveyor tab) |

## What to try

1. **Queue** — defaults to My claims; toggle All claims; filter by Claim Stage (FNOL / Intimation / Surveyor / Settlement); switch Highest risk ↔ Deadline (Yusuf Al-Qahtani’s low-risk claim due in 1d rises under Deadline). Claim Head / Admin / FIU: expand the chevron on the left of a row to open that claim’s version audit.
2. **Hard fail** — open `CLM-2026-08391` (Layla Hassan): red banner above score, tier forced Red.
3. **Can't evaluate** — open `CLM-2026-08344` or `CLM-2026-08460`: amber state distinct from fail. Missing documents also force linked checks to can't-evaluate without dropping the stage from the score average.
4. **Config** (Admin / FIU) — edit category / weightage; add or delete a use-case; set start and end dates to save as a new version.
5. **FNOL photos** — open `CLM-2026-08455` (Yusuf Al-Qahtani): FNOL shows 3/4 docs and a missing accident-scene photo set. Click the missing row to mock-upload (5 photos). Related checks pick up “Document on file” evidence; Surveyor pre-repair then shows **Already on file**.
6. **Surveyor set** — open `CLM-2026-08344` (Noura Al-Mazrouei): under Surveyor, upload the missing surveyor report, pre-repair photos, and parts list.
7. **Settlement IBAN** — still on `CLM-2026-08455`, scroll to Settlement and click the missing IBAN / payee proof row to mock-upload.
8. **Surveyor login** — `surveyor` / `demo123`. Queue shows every claim, with a Claim Stage column and stage filter. Open any claim: it lands on the Surveyor section; FNOL, Intimation, and Settlement are clickable. All / Passed / Failed / Can't evaluate count only that stage. On a claim that has completed FNOL and Intimation (e.g. `CLM-2026-08428` Hessa Al-Dhaheri), upload the surveyor report and parts list, then **Submit for further scoring**.
9. **Claim version audit** — as Claim Head / Admin / FIU, open Claims and click the chevron on the left of a row. The hidden log lists every prior change (create, assignment, documents, stage moves, score, FIU review) with version, date, time, user, action, old/new values, and comments. Claim User and Surveyor do not see the control.
10. **Use-case exceptions** — `claim.user` / `demo123`, open `CLM-2026-08391` (Layla Hassan). On the FNOL plate hard-fail, **Resolve**, set the claim plate to `AD 12-77109` (matches policy), add a comment, submit. Sign out. `claim.head` / `demo123` → same claim → **Approve**. Score/evidence update; the plate hard-fail can clear. Second path: toggle **All claims**, open `CLM-2026-08344` (Noura Al-Mazrouei), **Reject** the report-delay soft-fail → Head **Approve** → check shows **Waived** with an override mark on the tier. Surveyor has no exception buttons. Maker cannot approve their own request.
11. **Report** — `claim.head` / `demo123` → Report. Default Last 7 days; change Yesterday / MTD / branch / type / stage. Scorecard and composition stay a snapshot (no full claim dump). Click a use-case to cap the exception sample at 20; Reset section clears those chips. **Transactions**: inherits the report dates (max 31 days). Switch the ledger to Yesterday vs Last 7 days — grouped log, capped at 100, without changing the scorecard.
