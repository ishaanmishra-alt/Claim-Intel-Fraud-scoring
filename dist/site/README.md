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

## What to try

1. **Queue** — Claim User sees a single Claims list (no Sort, no My claims / All claims). Claim Head / Admin / FIU can still toggle My claims / All claims and sort. Filter by Claim Stage (FNOL / Registration / Assessment / Settlement). Claim and FNOL numbers sit together. Amount shows `-` until Settlement. Scores are percentages. Claim Head / Admin / FIU: expand the chevron on the left of a row to open that claim’s versions (V0–V5). Click a version to see who changed what and the use-case scores.
2. **Critical fail** — open `CLM-2026-08412` (Omar Al-Rashid) or `CLM-2026-08391` (Layla Hassan): a failed critical use-case marks that stage as **Fail**. Later stages are not scored until the check is bypassed (and approved) or corrected. Stage chips (All / FNOL / Registration / Assessment / Settlement) filter the claim; **All** is the default.
3. **Missing documents count as Fail** — open `CLM-2026-08344` or `CLM-2026-08460`: incomplete evidence is Failed, not a separate “Can't evaluate” state.
4. **Config** (Admin / FIU) — left tabs for FNOL / Registration / Assessment / Settlement scoring. Add or edit use-cases (same version dates flow). Critical use-cases are pass / fail (no weight). Remaining weights in the stage should read 100%. Set the stage pass mark for the weighted remainder.
5. **FNOL photos** — as Claim Head / Admin, open `CLM-2026-08455` (Yusuf Al-Qahtani): FNOL shows 3/4 docs and a missing accident-scene photo set. Click the missing row to mock-upload (5 photos). Related checks pick up “Document on file” evidence. Claim User sees the same documents highlighted under each stage’s **Documents** dropdown, without upload or use-case weightage.
6. **Assessment set** — open `CLM-2026-08344` (Noura Al-Mazrouei): under Assessment, upload the missing surveyor report, pre-repair photos, and parts list.
7. **Settlement IBAN** — still on `CLM-2026-08455`, scroll to Settlement and click the missing IBAN / payee proof row to mock-upload. Amount becomes visible once the claim is at Settlement.
8. **Claim versions** — as Claim Head / Admin / FIU, open Claims and click the chevron on the left of a row. Each claim keeps 5–6 versions (V0, V1, …). Columns are Version, FNOL no., Registration no., and Date. Click a version to open the detail pop-up. Dates use `dd-MMM-yyyy` (e.g. 11-Aug-2026).
9. **Bypass** — `claim.user` / `demo123`, open `CLM-2026-08391` (Layla Hassan). On a failed use-case, click **Bypass**. That sends a notification to the core system (out of scope). This prototype then shows the claim as if core approved: that use-case is excluded, and remaining weights in the stage are normalised to 100%.
10. **Report** — `claim.head` / `demo123` → Report. Claim versions is one row per claim (registration, FNOL, claimant, stage, score, latest version, last change). Search to find a file. Open **V0–V5** for that claim’s history, then click a version for the detail pop-up.
