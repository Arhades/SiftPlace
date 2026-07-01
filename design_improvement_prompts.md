# Prompts to Improve the SiftPlace Platform

Based on the [SiftPlace PRD](file:///c:/Users/looil/Desktop/SiftPlace/Bangkok_Student_Housing_Decision_Platform_PRD_v2.1.md), the current mobile-only HTML prototype at [prototype.html](file:///c:/Users/looil/Desktop/SiftPlace/frontend/prototype.html), and the Python FastAPI backend in the [backend/](file:///c:/Users/looil/Desktop/SiftPlace/backend) directory, here is a suite of structured prompts you can copy-paste to upgrade the site.

---

## 1. Visual Aesthetics & Polish (The "Wow" Factor)

### Prompt: Modern Layout & Responsive Grid
```text
Please upgrade the layout in `frontend/prototype.html`. Currently, the site is wrapped in a hardcoded `.phone` class mimicking a mobile view on desktop. 
Please refactor this into a modern responsive layout:
1. On mobile screens (under 768px), keep the clean, single-column scrollable layout with a bottom navigation bar.
2. On desktop/tablet screens (768px and up), transform it into a beautiful dual-pane dashboard layout:
   - Left side: Sticky preference questionnaire, sliders, inputs, and the free-text NLP field.
   - Right side: Dynamic results pane showing the top matched apartments, an interactive map block, local insights, and neighborhood explore cards side-by-side.
3. Replace the page background and border styling to feel like a premium web app. Keep the 'Solar Friend' color palette (warm yellows, cream surfaces, deep blues, soft oranges) but improve the card styling with soft borders and refined padding.
```

### Prompt: SVG Icon Integration (Removing Emojis)
```text
Please refactor `frontend/prototype.html` to replace all emoji-based icons (such as 🥊, 🛒, 🚆, 🌿, 🌙, etc.) with clean, premium SVG icons. 
1. Use an embedded icon set like Lucide icons (loaded via CDN) or direct SVG pathways.
2. Replace:
   - Navbar icons: Matches (Search icon), Saved (Heart icon), Areas (Map icon), Guide (Help/Book icon).
   - Preference indicators & chips: Gym (Dumbbell icon), Supermarket (Shopping cart), Transit (Train/Subway), Mall (Bag/Store), Flea market (Tag/Store), Vibe styles (Leaf / Sparkles icons).
   - Theme toggle, back button, and checklist badges.
3. Ensure consistent SVG sizing (e.g., 20x20 or 24x24 pixels) with standard sizing classes.
```

### Prompt: Glassmorphism & Dark Mode Transition Animations
```text
Please refine the visual styling of `frontend/prototype.html` by applying premium CSS styling details:
1. Implement glassmorphism for floating UI elements like the app header and bottom navigation bar (using `backdrop-filter: blur(12px)` and translucent backgrounds like `rgba(255,255,255,0.7)` for light mode, `rgba(23,19,15,0.7)` for dark mode).
2. Add micro-interaction styling: smooth transition effects on button clicks, card hovers, slider thumb dragging, and chip selections (`transition: all 0.2s ease`).
3. Enhance the dark mode transition so that toggling the theme shifts background colors smoothly over 300ms.
```

---

## 2. Implementing Missing PRD Features

### Prompt: Compare Pillar — Side-by-Side Comparison
```text
The SiftPlace PRD specifies a 'Compare' pillar: compare the top three matched apartments side-by-side. The current `frontend/prototype.html` has no comparison page.
Please add this feature:
1. Create a new tab or comparison view. Add a 'Compare' button or checkbox to the top 3 matches cards.
2. When the user clicks 'Compare', show a clean side-by-side table or card-grid comparing the selected items on:
   - Final Match Score
   - Monthly Base Rent vs. Estimated True Cost (Rent + Commute Cost)
   - One-way Commute Time (minutes) and distance to their anchor campus
   - Amenities available (tick/cross checklist)
   - Local vibe rating and street safety
3. Ensure the comparison UI is responsive, stacking cleanly on mobile and presenting side-by-side columns on desktop.
```

### Prompt: Verify Pillar — Leaflet.js Map Integration
```text
The PRD outlines a 'Verify' pillar that includes showing an interactive map of recommendations. The current prototype only uses flat background gradients or placeholder cards.
Please integrate Leaflet.js into `frontend/prototype.html`:
1. Load Leaflet's CSS and JS via CDN in the head.
2. Replace the static gradient elements with a map container `#map` (height: 250px on mobile, larger on desktop).
3. Initialize the map centered on the user's selected commute anchor (e.g., Chulalongkorn University).
4. Render markers on the map for:
   - The user's Daily Destination (custom anchor marker)
   - The Top 3 recommended housing options (color-coded markers or markers showing the Match Score, e.g., '92%')
5. Bind simple popups to each housing marker showing its name, price, commute time, and a 'View Details' link.
```

### Prompt: Explain Pillar — Interactive Match Score Breakdown
```text
The PRD states: 'Explain: Every recommendation includes: Match score, Why it was selected, Strengths, and Trade-offs.'
Please build a detailed modal or expandable accordion section for each recommended card in `frontend/prototype.html`:
1. When a user clicks 'Why this match?' or the 'View details' button on an apartment card, display a modal or slide-over drawer showing a breakdown of their score.
2. Present visual progress bars for each subscore:
   - Cost Score (how it fits their budget)
   - Location Score (how it matches transit and nearby vibes)
   - Living Score (how it matches room size, desk availability, and amenities)
3. Generate descriptive text highlighting:
   - Strengths (e.g., '10 minutes from campus', 'Has a dedicated study desk')
   - Trade-offs (e.g., 'No building pool', 'Slightly above your target rent')
```

### Prompt: Prepare Pillar — Interactive Relocation Guides
```text
The PRD lists a 'Prepare' pillar for when a student secures a room (Airport guide, SIM card, BTS/MRT guide, Banking, Visa checklist). The current prototype only lists renting checklists.
Please expand the Guide panel in `frontend/prototype.html` into a comprehensive relocation hub:
1. Add tabs or a dashboard layout inside the Guide tab: 'Renting Safety', 'Transit & BTS/MRT', 'Banking & SIM', and 'Arrival Checklist'.
2. Populate these sections with clean, actionable advice for exchange students moving to Bangkok.
3. Include interactive checkboxes so users can tick off steps as they complete them (e.g., 'Get Rabbit card', 'Buy AIS Tourist SIM', 'Print Lease Contract'). Store checklist progress in `localStorage` so it persists.
```

---

## 3. Frontend-Backend Integration

### Prompt: Connect Prototype to Python FastAPI Backend
```text
Please modify the JavaScript inside `frontend/prototype.html` to connect with the local FastAPI backend (at `http://127.0.0.1:8000`).
1. Replace the frontend scoring calculation functions with asynchronous `fetch` calls to the backend API:
   - Use `/geocode?q=[city]` to resolve the user's target city and destination text coordinates dynamically.
   - Use `POST /score` to send the weights, budget, anchor, and checklists, and receive scored listings from the server.
   - Use `POST /search` to fetch real OpenStreetMap points of interest when searching for a city.
2. Add smooth loading states (skeleton screens or spinner overlays) while the fetch calls are in progress.
3. Fall back gracefully to the offline mockup dataset if the backend server is unreachable.
```
