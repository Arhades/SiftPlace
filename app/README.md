# SiftPlace — product app

The real matching UI: set your priorities → SiftPlace geocodes your commute
destination, fetches real listings from OpenStreetMap, and ranks them by **true
monthly cost** (rent + the Grab/Bolt or motorbike-taxi fare it takes to commute),
not rent alone. Same dark-indigo brand as the `waitlist/` marketing site.

It does **not** compute matches itself — it calls the FastAPI backend in `../backend`
over HTTP. The backend's location comes from `VITE_API_URL`.

## Run locally (two terminals)

```bash
# 1) backend  (http://localhost:8000)
cd backend && pip install -r requirements.txt && uvicorn main:app --reload

# 2) this app
cd app && npm install
VITE_API_URL=http://localhost:8000 npm run dev
```

Then open the printed Vite URL (default http://localhost:5173).

Copy `.env.example` to `.env` to set `VITE_API_URL` permanently instead of passing
it inline.

## Honest data note

`/search` returns **real** names, coordinates and nearby distances (free
OpenStreetMap) but **no real prices, amenities or reviews** yet — cards show
"price on request" where price is unknown. **Fares are estimates** from a
transparent model (base + per-km + per-min, separate car/bike rates) in
`../backend/fare.py`, not live Grab/Bolt prices.

## Stack

React 19 · TypeScript · Vite · Tailwind 4 · framer-motion · lucide-react.
