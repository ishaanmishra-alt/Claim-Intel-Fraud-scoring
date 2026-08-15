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

1. **Queue** — defaults to My claims; toggle All claims; filter by Claim Stage (FNOL / Registration / Assessment / Settlement). Claim and FNOL numbers sit together. Amount shows `-` until Settlement. Scores are percentages. Claim Head / Admin / FIU: expand the chevron on the left of a row to open that claim’s version audit.
2. **Critical fail** — open `CLM-2026-08391` (Layla Hassan): a failed critical use-case zeros that stage and forces High risk. If the critical later passes, it scores with the other weighted checks.
3. **Missing documents count as Fail** — open `CLM-2026-08344` or `CLM-2026-08460`: incomplete evidence is Failed, not a separate “Can't evaluate” state.
4. **Config** (Admin / FIU) — left tabs for FNOL / Registration / Assessment / Settlement scoring. Add or edit use-cases (same version dates flow), set weightage (footer should read 100%), set the stage pass mark, and on Registration / Assessment / Settlement set cumulative mix, e.g. Overall = (FNOL × 40%) + (Registration × 60%).
5. **FNOL photos** — open `CLM-2026-08455` (Yusuf Al-Qahtani): FNOL shows 3/4 docs and a missing accident-scene photo set. Click the missing row to mock-upload (5 photos). Related checks pick up “Document on file” evidence.
6. **Assessment set** — open `CLM-2026-08344` (Noura Al-Mazrouei): under Assessment, upload the missing surveyor report, pre-repair photos, and parts list.
7. **Settlement IBAN** — still on `CLM-2026-08455`, scroll to Settlement and click the missing IBAN / payee proof row to mock-upload. Amount becomes visible once the claim is at Settlement.
8. **Claim version audit** — as Claim Head / Admin / FIU, open Claims and click the chevron on the left of a row. Dates use `dd-MMM-yyyy` (e.g. 11-Aug-2026).
9. **Use-case exceptions** — `claim.user` / `demo123`, open `CLM-2026-08391` (Layla Hassan). On the FNOL plate critical, **Resolve**, set the claim plate to `AD 12-77109` (matches policy), add a comment, submit. Sign out. `claim.head` / `demo123` → same claim → **Approve**. Score/evidence update; the plate critical can clear. Second path: toggle **All claims**, open `CLM-2026-08344` (Noura Al-Mazrouei), **Reject** a soft-fail → Head **Approve** → check shows **Waived**.
10. **Report** — `claim.head` / `demo123` → Report. Start and end dates sit on the snapshot and on Transactions. Export the whole report or the transaction ledger. Transaction columns include Claim, FNOL, Policy, cumulative score %, and current stage (not “Completed”).
