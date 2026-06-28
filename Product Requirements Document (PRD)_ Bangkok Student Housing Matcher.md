# Product Requirements Document (PRD): Bangkok Student Housing Matcher

**Status:** Idea Validation Phase  
**Target Market:** International Exchange & Internship Students in Bangkok  
**Author:** Manus AI (Collaborating with Founder)  
**Date:** June 25, 2026

---

## 1. Executive Summary

The **Bangkok Student Housing Matcher** is a specialized "decision-layer" SaaS designed to solve the high-stakes problem of choosing accommodation in a foreign, sprawling city. Unlike traditional booking platforms (such as Airbnb or Agoda) that optimize purely for transactions and inventory display, this tool focuses on **personalized matching** through a multi-criteria weighted-scoring engine. 

It is built specifically to help international students and interns find the perfect 3–6 month stay by prioritizing the factors that actually dictate quality of life in Bangkok: true commute costs, hyper-local street accessibility, and specific room conditions (like the presence of a study desk) that are often hidden in listing photos. The product acts as a smart filter, doing the heavy lifting for users who lack the local knowledge to evaluate a neighborhood themselves.

---

## 2. Problem Statement & Origin

The idea originated from the founder's own painful experience of choosing accommodation in Thailand and regretting the choice. Picking a place in an unfamiliar city is fraught with hidden variables. 

### The Core Pain Points

*   **Information Asymmetry:** Students do not know which "Sois" (streets) are prone to flooding, which areas are genuinely walkable, or where the nearest "Win" (motorbike taxi) stand is located. A street that looks central on a map might be a nightmare to navigate during rush hour.
*   **The "3-6 Month" Inventory Gap:** Most condominiums in Bangkok legally require 1-year leases. Conversely, Airbnb is expensive and often legally restricted for stays under 30 days. The "sweet spot" for students is the serviced apartment or monthly rental market, which is highly fragmented.
*   **Hidden Commute Costs:** A "cheap" apartment located 5 kilometers from a BTS station might ultimately cost more in daily Grab or taxi fees—and consume hours of daily traffic—than a slightly more expensive, centrally located apartment.
*   **Search Fatigue & Binary Filters:** Existing platforms use binary filters (e.g., "Has Gym: Yes/No"). Users cannot express nuanced preferences, such as "I care *mostly* about cost, but I am *somewhat* willing to pay more for a quiet street and a good desk." Consequently, most people fall back on asking for free advice in group chats or forums.

---

## 3. Target Audience & Market Landscape

### Target User Persona
The initial focus is strictly on **students going abroad on exchange or internship in Bangkok**. 

*   **Why this wedge is strong:** 
    *   They stay for 3–6 months; a bad choice is a costly mistake, making a good match highly valuable.
    *   They are often abroad alone for the first time and genuinely lack the context to judge a neighborhood.
    *   They are budget-conscious, making the "true cost" factor central to their decision-making.
    *   They cluster in highly findable channels (e.g., university buddy groups, internship program chats, r/Bangkok, expat Facebook groups).

### Market Landscape & Differentiation
The broad "AI hotel finder" category is crowded with tools like iMean, DealswithAI, and Wonderplan. However, these tools focus on short-term tourism. 

**The Gap:** No existing tool combines explicit user-set weights with hyper-local factors (e.g., walkability, proximity to a martial arts gym, external accessibility) into a single ranking for medium-term stays. 

**The Real Competitor:** The actual competitor is not another app; it is "ask ChatGPT" or "ask the group chat for free." The product must provide a faster, more accurate, and more convenient experience than free human advice.

---

## 4. Product Vision & Value Proposition

**Vision:** To serve as the "trusted local friend" who processes complex urban data to make housing decisions effortless for newcomers.

**Value Proposition:** "Stop guessing. Find a home in Bangkok that fits your life, your commute, and your budget—powered by local data and smart matching."

**Positioning Statement:** The goal of the app is not to reinvent the house-listing market, but to sit on top of existing listings as a convenience layer that does the thinking Airbnb leaves to the user.

---

## 5. Core Features & Functionality

The product will be rolled out in phases, starting with a manual concierge service to validate demand, followed by an automated MVP.

### Phase 1: MVP (The "Smart Engine")

The MVP focuses on the core weighted-scoring algorithm and the most critical local data points.

| Feature | Description | Priority |
| :--- | :--- | :--- |
| **Weighted Intake Form** | A Typeform-style interface where users assign weights (0-100%) to three top-level factors: Cost, Location (sub-factors: near transit, quiet vs. lively), and Living Conditions (amenities, space). | P0 |
| **Real-Cost Commute Calculator** | Calculates the true monthly cost of living by factoring in commute frequency and mode. Users can select their preferred "Commute Style" (e.g., BTS/MRT only, Motorbike Taxi, Grab) to calculate real time and financial cost. | P0 |
| **External Accessibility Score** | Scores listings based on how easy it is to leave the Soi and access outside facilities. This includes walking distance to main roads, 7-Elevens (a proxy for safety and convenience), and supermarkets. | P1 |
| **Map-Based Verification** | After receiving their top recommendations, users are presented with an interactive map view to verify the location, nearby amenities, and street layout themselves. | P1 |

### Phase 2: The "AI" & Convenience Layer (Differentiation)

Once the core engine is validated, the product will introduce advanced features to widen the moat.

| Feature | Description | Priority |
| :--- | :--- | :--- |
| **Photo Amenity Detection (CV)** | Uses Computer Vision to scan listing photos and detect valuable features rarely tagged in text descriptions, such as a usable study desk, natural light, or specific room conditions. | P2 |
| **Street-Vibe NLP** | Mines reviews and forum data using NLP to tag streets with hyper-local vibes (e.g., "Digital Nomad Hub," "Street Food Heaven," "Expat Bubble"). | P2 |
| **Flood-Risk & Seasonality Score** | Integrates historical weather and elevation data to warn users if a specific Soi is prone to severe flooding during Bangkok's rainy season (September/October). | P3 |
| **Scam Prevention Guide** | A localized, integrated guide advising students on how to safely pay deposits and verify landlords, addressing a major anxiety point for first-time renters in Thailand. | P3 |

---

## 6. Technical Architecture & Data Strategy

The technical approach prioritizes free or low-cost APIs to maintain sustainable unit economics during the early stages.

### Data Sources
*   **Proximity & Routing Data:** OpenStreetMap (OSM) and Overpass API. This provides free, no-per-request billing for locating gyms, supermarkets, transit, and calculating commute routes.
*   **Inventory Data:** 
    *   *Initial Focus:* RentHub.in.th (the dominant local platform for monthly rentals and serviced apartments). Data will need to be aggregated carefully, prioritizing properties known to accept 3-6 month leases.
    *   *Secondary:* Travelpayouts affiliate API for hotel/serviced apartment inventory.
*   **Street-Vibe Labels:** NLP applied over reviews and forums (e.g., r/Bangkok, ASEAN Now), curated manually in the early stages.

### System Architecture
*   **Matching Engine:** A multi-criteria weighted-scoring algorithm (e.g., Euclidean distance or linear scoring: `Score = Σ (Weight * NormalizedFactor)`). No LLM is needed for the v1 matching logic.
*   **Frontend:** A lightweight web application (React/Next.js) optimized for mobile, as students primarily browse on their phones.
*   **Hosting:** Vercel or Netlify (free tiers) combined with Formspree or Google Forms for initial intake.

---

## 7. Monetization Strategy

The product must remain free for the end-user to eliminate friction and encourage rapid adoption within student cohorts.

1.  **Affiliate Commission (Primary):** Lead with affiliate links (via Travelpayouts, Agoda, or direct partnerships with serviced apartments). The platform earns a commission when a user books through the provided link.
2.  **Deferred Paid Tier:** A premium tier (e.g., a $10 "Deep Dive" custom report with hand-verified options) will only be introduced after significant traction is achieved. Introducing a paywall too early would stall user acquisition.

---

## 8. Limitations, Risks & Mitigations

| Risk | Description | Mitigation Strategy |
| :--- | :--- | :--- |
| **Distribution** | "Simple to use" is a product attribute, not a go-to-market strategy. Acquiring the first users is the biggest hurdle. | Partner directly with university International Offices and embed actively in specific Facebook groups and Reddit communities. |
| **Data Access** | Airbnb blocks scraping, and RentHub does not have a public API. | Focus on serviced apartments and RentHub via careful aggregation. Build direct relationships with 5-10 key student-friendly buildings to guarantee initial inventory. |
| **API Costs** | Google Places API scales poorly with user volume. | Strictly use OpenStreetMap for proximity data. Precompute data for key Bangkok neighborhoods and cache aggressively. |
| **Thin Moat** | A weighted calculator is easily copied by competitors. | Defensibility will come from accumulated, proprietary street-level data (the NLP vibe tags) and real user-preference data over time. |

---

## 9. Execution Phases & Roadmap

### Phase 0: Validate Demand (Current Phase)
*   **Goal:** Prove that students want this service and will fill out the intake form.
*   **Action:** Launch a simple landing page with a weight-intake form. Drive 10–20 Bangkok exchange students to it.
*   **The "Human Algorithm":** The founder manually acts as the matching engine. Look up places on RentHub/Google Maps based on the user's criteria, check for external accessibility and room conditions, and email them a curated "Top 3" list.
*   **Success Metric:** Number of completed forms and qualitative positive feedback on the recommendations.

### Phase 1: MVP Engine Build
*   **Goal:** Automate the Phase 0 process.
*   **Action:** Build the city-agnostic weighted-scoring engine. Integrate OSM for the commute-cost calculator and nearby-gym/7-Eleven search. Precompute proximity for key university areas (e.g., Samyan, Phaya Thai, Salaya).

### Phase 2: Polish & Grow
*   **Goal:** Establish a repeatable distribution loop.
*   **Action:** Refine the UI to include the interactive map verification feature. Wire up affiliate links to begin monetization. Expand coverage to all major Bangkok neighborhoods.

### Phase 3: ML & CV Refinement
*   **Goal:** Build the technical moat.
*   **Action:** Once enough real user interaction data is logged, train a model to personalize weighting. Introduce the Computer Vision feature to detect study desks and room conditions from photos.

### Phase 4: Geographic Expansion
*   **Goal:** Scale the business.
*   **Action:** Point the engine at the next sprawling, complex city (e.g., Chiang Mai, Tokyo, Ho Chi Minh City) using the established pipeline.

---

## 10. Team & Roles

*   **Founder:** Year-2 Computer Science student. Focuses on the core matching algorithm, user acquisition (Phase 0 manual matching), and overall product vision.
*   **Co-founder:** Brings experience building similar systems. Focuses on data aggregation (RentHub/OSM integration), backend architecture, and future ML/CV implementation.
