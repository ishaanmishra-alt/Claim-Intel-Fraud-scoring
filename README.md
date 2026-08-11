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

## What to try

1. **Queue** — defaults to My claims; toggle All claims; switch Highest risk ↔ Deadline (Yusuf Al-Qahtani’s low-risk claim due in 1d rises under Deadline).
2. **Hard fail** — open `CLM-2026-08391` (Layla Hassan): red banner above score, tier forced Red.
3. **Can't evaluate** — open `CLM-2026-08344` or `CLM-2026-08460`: amber state distinct from fail.
4. **Config** (Admin) — edit soft-signal weights; live total; Save blocked with gap nudge unless exactly 100%.
