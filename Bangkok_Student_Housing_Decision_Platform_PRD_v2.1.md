# SiftPlace PRD

## Version

**Version:** 2.1\
**Status:** Product Design (Founder Edition)

## 1. Vision

### Mission

Help international students and interns confidently choose the best
place to live in Bangkok---not by showing thousands of listings, but by
helping them make the **right decision**.

### Vision Statement

Become the trusted relocation companion for students moving abroad.

When someone receives an exchange or internship offer in Bangkok, this
should be the first website they visit before Airbnb, RentHub, or Agoda.

The platform removes uncertainty by combining local knowledge, weighted
decision-making, transparent explanations, and intelligent comparisons.

## 2. Problem Statement

Finding accommodation overseas is easy.

Choosing the **right** accommodation is difficult.

Students spend hours: - Asking seniors - Searching Reddit/Facebook -
Comparing Google Maps - Estimating commute costs - Checking amenities
manually

A wrong decision leads to: - Long commutes - Hidden transport costs -
Poor study environments - Inconvenient locations - Regret for 3--6
months

Our platform is a **decision layer**, not another listing marketplace.

## 3. Product Principles

1.  Reduce uncertainty.
2.  Explain every recommendation.
3.  Stay student-first.
4.  Use structured data first; use AI only when it adds clear value.
5.  Optimize for confident decisions, not the largest inventory.

## 4. Target Audience

### Phase 1

-   Exchange students
-   Internship students
-   3--6 month stays

### Future

-   Master's students
-   PhD students
-   Young professionals
-   Digital nomads
-   Expats

## 5. Product Pillars

### Match

Users assign weights to: - Budget - Commute - Quietness - Convenience -
Study environment - Lifestyle - Amenities

The engine returns the top three recommendations.

### Explain

Every recommendation includes: - Match score - Why it was selected -
Strengths - Trade-offs

Generated deterministically from scoring data.

### Verify

Every recommendation includes: - Interactive map - Street View - Nearby
amenities - Transit - Commute estimate - Flood information - Photos

### Compare

Compare the top three apartments side-by-side.

### Prepare

After booking: - Airport guide - SIM card - BTS/MRT guide - Banking -
Visa checklist - Emergency contacts - Grocery guide - First-week
checklist

## 6. User Journey

``` text
Accepted Offer
    ↓
Preference Questionnaire
    ↓
Matching Engine
    ↓
Top 3 Recommendations
    ↓
Compare
    ↓
Verify
    ↓
Book
    ↓
Relocation Guides
```

## 7. Information Architecture

``` text
Home
Find Housing
Compare
Saved
Map
Neighborhoods
Budget Calculator
Student Guides
Profile
```

## 8. Matching Algorithm

Final Score = Σ(User Weight × Normalized Apartment Score)

Categories: - Cost - Commute - Convenience - Study Environment -
Lifestyle - Accessibility - Environmental Risk

## 9. Data Sources

-   OpenStreetMap
-   Open-Meteo
-   Google Maps / Street View (optional)
-   RentHub
-   Airbnb
-   Future university & landlord partnerships

## 10. Technical Stack

Frontend: - Next.js - React - Tailwind CSS

Backend: - Spring Boot

Database: - PostgreSQL + PostGIS

Hosting: - Vercel - Railway

Maps: - Leaflet + OpenStreetMap

## 11. Monetization

Primary: - Affiliate bookings

Secondary: - Premium reports - Verified listings - Featured partners -
University partnerships

## 12. Roadmap

### Phase 0

-   Landing page
-   Questionnaire
-   Manual recommendations
-   User interviews

### Phase 1

-   Matching engine
-   Saved apartments
-   Compare
-   Maps
-   Budget calculator

### Phase 2

-   Neighborhood explorer
-   Student guides
-   SEO
-   User accounts

### Phase 3

-   Computer vision
-   Neighborhood NLP
-   Personalization
-   Reviews

### Phase 4

Expand to: - Chiang Mai - Ho Chi Minh City - Kuala Lumpur - Tokyo -
Seoul

## 13. North Star Metric

**Decision Confidence**

Supporting metrics: - Questionnaire completion - Save rate - Comparison
usage - Booking conversion - User satisfaction - Return rate

## 14. Long-term Moat

-   Hyper-local neighborhood intelligence
-   Student-specific knowledge
-   Transparent explanations
-   Proprietary preference data
-   Relocation ecosystem
-   Decision-first UX
