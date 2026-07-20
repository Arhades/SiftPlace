# Product Requirements Document (PRD): SiftPlace — Bangkok Student Housing Matcher

**Status:** Live product (built & shipping) · validated with early users
**Target Market:** International Exchange & Internship Students in Bangkok
**Author:** SiftPlace Founding Team
**Date:** 9 July 2026
**Live:** https://sift-place.vercel.app/

---

## 1. Executive Summary

**SiftPlace** is a "decision-layer" web app that helps people moving to an unfamiliar city decide *where* to live by matching accommodation to their personal priorities, rather than only to a property's listed features. It sits **on top of existing listings** as a convenience layer that does the thinking Airbnb, Agoda and Booking leave to the user.

The product is **built and live**, not a concept. A React PWA (front end) backed by a Python FastAPI engine ranks candidate homes with a multi-criteria weighted-scoring algorithm and, crucially, surfaces the one number incumbents hide: the **true monthly cost** — rent **plus the commute** (fare *and* hours on the road). Around that core we have shipped lease-type filtering, a cost-of-living breakdown, community reviews and scam reporting, live affiliate monetization, and crash reporting. A conversational "Sift" mascot and semantic search are the next (competition) build.

The wedge is deliberately sharp: international students on a 3–6 month exchange or internship in Bangkok, who face a high-stakes, unfamiliar, anxiety-inducing housing decision and currently fall back on group chats and guesswork.

---

## 2. Problem Statement & Origin

The idea came from the founder's own costly accommodation mistake abroad. Choosing a place in an unfamiliar, sprawling city is full of hidden variables.

### Core pain points

*   **Filters describe the property, not the lived experience.** Incumbents filter on what a place *has* (pool, wifi) plus a few landmarks. They cannot tell you whether the street is quiet, walkable, safe at night, or near a real gym or supermarket.
*   **The "true cost" of a location is hidden.** A cheap room far from campus quietly costs more in daily transport money — and in *time*. Students optimise on rent and get blindsided by the commute. A "cheap" ฿8,000 room can carry 6+ hours/month on the road and hundreds in fares.
*   **The 3–6 month inventory gap.** Most Bangkok condos require 1-year leases; Airbnb is expensive and legally restricted under 30 days. The student sweet spot — serviced apartments and monthly/agent-managed rentals — is highly fragmented and barely indexed by Booking/Agoda.
*   **Decisive information lives only in reviews.** Street conditions, hidden-gem gyms, flea markets and pest issues (cockroaches and mice are common in some units) are readable only by trawling dozens of reviews.
*   **Binary filters and search fatigue.** Users cannot express nuance like "I care *mostly* about cost, but I'll pay a bit more for a quiet street and a real desk." So they repeat the search dozens of times, or ask a group chat for free.

---

## 3. Target Audience & Market Landscape

### Target persona
International students on **exchange or internship in Bangkok** (the beachhead).

*   Stay 3–6 months; a bad choice is a costly, hard-to-undo mistake — so a good match is highly valuable.
*   Often abroad alone for the first time; genuinely lack the context to judge a neighbourhood.
*   Budget-conscious, which makes the **true-cost** factor central.
*   Cluster in reachable, *renewing* channels: university exchange cohorts, internship programmes, r/Bangkok, expat/student groups.

### Landscape & differentiation
The broad "AI hotel finder" space (short-term tourism tools) is crowded but aimed elsewhere. **The gap:** no tool combines explicit user-set weights with hyper-local factors — street vibe, walkability, gym/supermarket/transit proximity, and true commute cost (money *and* time) — into one ranked answer for medium-term stays. **The real competitor** is "ask ChatGPT" or "ask the group chat for free"; SiftPlace must be faster, more accurate and more convenient than free human advice, with an opinionated, data-backed pick rather than a database.

---

## 4. Product Vision & Value Proposition

**Vision:** the "trusted local friend" that processes complex urban data to make housing decisions effortless for newcomers.

**Value proposition:** *"See the true monthly cost — not just the rent. Know before you commit."*

**Positioning:** not another listing site — a decision layer on top of existing listings that does the thinking for you.

**Two product forms, one engine.**
*   **Form A — Web app (live).** Set your priorities, get a ranked shortlist. Works on any device; PWA-installable. Our current product and validation vehicle.
*   **Form B — Browser extension (later).** Overlays SiftPlace scores directly onto Airbnb/Booking/Agoda pages — reading listing data from the page the user already opened, which sidesteps the lack of a public listings API.

---

## 5. Core Features & Functionality

### Shipped and live today

| Feature | Description | Status |
| :--- | :--- | :--- |
| **Weighted intake** | Users spend a 20-point budget across **Cost / Location / Living**, plus nearby wants (24/7 supermarket, gym/martial-arts, mall, flea market, transit) and quiet-vs-lively vibe. Explainable sub-scores combine into a 0–100 match. | Live |
| **True Monthly Cost + Time Cost** | The headline. Ranks homes by **rent + commute fare + hours on the road**, per commute mode (Grab/Bolt car, motorbike taxi, transit, walk). Shows a **distance trade-off** callout and break-even ("living closer saves ฿X/mo and Y hours"). | Live |
| **Hyper-local place data** | Nearby POIs and distances from OpenStreetMap/Overpass; geocoding via Nominatim — real names and coordinates at zero per-request cost. | Live |
| **Lease-type filter** | Filter by standard (12mo) / short-term (3–6mo) / monthly rolling, with a "confirm visa requirements with the landlord" note. | Live |
| **Cost-of-living breakdown** | A "what else you'll spend" panel per listing (utilities, internet, mobile, food) from open-data estimates, tuned over time. | Live |
| **Community reviews & scam reporting** | Every listing is clickable → detail panel showing how many students viewed it, a 👍/👎 accuracy rating with an optional scam report (auto-flag at 3+ negatives), and a student comments space. Backed by Supabase. | Live |
| **Flood-risk & seasonality** | Blends seasonal rainfall, the Sep–Oct rainy window and elevation into a low/moderate/high flood flag (free Open-Meteo data). | Live |
| **Free-text "Anything else?" NLP** | Extracts structured demands from plain-language notes via an editable keyword bag-of-words **plus a trained multi-label classifier** (Porter-stemmed → Naive Bayes/MLP), improved by founder-labelled notes each week. | Live |
| **Areas explorer** | Each neighbourhood opens to its top popular listings for a fast browse. | Live |
| **Instant defaults** | First visit shows curated "Popular in Bangkok" listings with zero API calls, so the app never opens on a spinner. | Live |
| **Crash / problem reporting** | A "report this problem" button plus an automatic uncaught-crash reporter to Supabase (survives the backend being down); email fallback. | Live |

### Next build — the "creative AI" layer (competition, ~1 month)

| Feature | Description | Status |
| :--- | :--- | :--- |
| **"Sift" mascot chatbot** | A friendly mascot (hovering avatar) that (a) converses to set the filters — replacing much of the long form — and (b) acts as a **Bangkok housing concierge** answering neighbourhood questions and what to look out for. Powered by **Agnes AI** (competition criterion), with OpenAI and the local NLP as fallbacks. | Building |
| **Semantic search on GMI Cloud** | Host an embedding model on the competition's Nvidia GPU credits; vector-search listings and LLM-rerank/explain in the user's own words. | Building |
| **3×2 results grid** | Paginated, scannable grid replacing the long list. | Building |
| **Roommate Match (experiment)** | Let solo students find compatible flatmates to co-rent larger units (lightweight profiles + preferences). | Planned |
| **Photo amenity detection (CV)** | Detect a usable study desk, natural light, etc. from listing photos — the ML/CV showcase. | Later |

---

## 6. Technical Architecture & Data Strategy

Prioritises free or low-cost APIs to keep unit economics sustainable early.

**Stack.** Front end: React 19 + TypeScript + Vite + Tailwind, PWA, deployed on Vercel. Back end: Python FastAPI (Render/Fly). Community & telemetry data: Supabase. NLP: NLTK + scikit-learn.

**Data sources.**
*   **Proximity & routing:** OpenStreetMap / Overpass (free, no per-request billing) for gyms, supermarkets, transit and distances; Nominatim for geocoding; Open-Meteo for flood/seasonality.
*   **Priced inventory:** Travelpayouts (aggregating Booking/Agoda), Agoda, Hotelbeds (sandbox), later Expedia — merged with OSM via a pluggable provider layer.
*   **Agent-managed / monthly inventory (the gap):** **in discussion with Horganize**, an agent network with contacts across many Bangkok condo/apartment agents — precisely the fragmented monthly stock that Booking/Agoda don't cover, and a route to a real inventory moat.
*   **Street-vibe labels:** seeded manually for Bangkok (founder in-market), enriched by every user input and the community reviews layer.

**Matching engine.** Multi-criteria weighted scoring (`Score = Σ weight × normalized_factor`), with a "true cost" overlay (fare model) and explainable per-listing sub-scores. No LLM is required for v1 matching; LLMs power the conversational and semantic layers.

**Monetization plumbing.** Affiliate commission is **live**: pre-departure checklist and booking links route through Travelpayouts (`tp.media` redirect carrying our marker → attribution cookie → any purchase credits us), no user account needed. Multi-vendor picker for eSIM / insurance / flights; catalogue in `affiliates.ts`.

---

## 7. Monetization Strategy

Free for users to eliminate friction; revenue without a growth-killing paywall.

1.  **Affiliate commission (live, primary early).** Travelpayouts/Agoda booking + travel-services links keep the product free and earn on bookings.
2.  **B2B2C (the real engine).** License SiftPlace to university international offices, exchange/internship programmes and student co-living operators — institutions with a duty of care and a budget to reduce housing friction. Students use it free; institutions pay.
3.  **Qualified lead-gen.** Each sign-up is a high-intent mover with stated preferences and dates — valuable to student-housing and co-living providers.
4.  **Deferred paid tier.** A premium "deep-dive" custom report only after significant traction.

---

## 8. Limitations, Risks & Mitigations

| Risk | Description | Mitigation |
| :--- | :--- | :--- |
| **Distribution** | Acquiring the first users is the biggest hurdle; "simple to use" is not a GTM strategy. | Partner with university international offices; embed in specific Facebook/Reddit communities; renewing cohort + referrals. |
| **Inventory / data access** | Airbnb blocks scraping; monthly/agent stock has no clean API. | Affiliate APIs for hotels; **Horganize partnership** for agent-managed condos; direct deals with student-friendly buildings; browser-extension form reads the page the user opened. |
| **Single-use / low retention** | Users choose housing infrequently. | Win via renewing annual student cohort, referrals and the B2B2C model — not repeat consumer use. |
| **API costs** | Paid geo APIs scale poorly with volume. | Strictly OpenStreetMap for proximity; cache aggressively; precompute key neighbourhoods; founder usage/budget dashboard. |
| **Thin moat** | A weighted calculator is easy to copy. | Defensibility from accumulated proprietary data — community reviews, street-vibe labels, real user-preference data — plus curation/judgement for one persona in one city. |

---

## 9. Execution Phases & Roadmap

*   **Phase 0 — Validate demand (done).** Live landing page + weighted intake form; founder hand-matched the first cohort as a manual "concierge" to test trust and generate the first preference data.
*   **Phase 1 — Engine (built).** City-agnostic weighted-scoring engine; OSM commute-cost + nearby search; flood/seasonality; NLP; React PWA on Vercel.
*   **Phase 2 — Partners & monetization (in progress).** Real priced inventory via affiliates (**live**); Horganize agent-inventory partnership (in discussion); community reviews/scam reporting; lease filter; cost-of-living; crash reporting; first institutional pilot conversations.
*   **Phase 3 — Creative AI (competition, ~1 month).** "Sift" mascot on Agnes AI; semantic embedding search on GMI Cloud; 3×2 grid; roommate-match experiment.
*   **Phase 4 — Expansion.** Point the pipeline at the next sprawling city (e.g. other ASEAN metros), and ship Form B (the browser extension).

---

## 10. Team & Roles

*   **Founder** — Year-2 Computer Science student, ML interest; in-market in Bangkok. Owns the matching algorithm, product vision, user acquisition (Phase 0 concierge) and the NLP/ML build.
*   **Co-founder** — experience building similar systems; owns data aggregation, backend architecture, and future ML/CV work.
