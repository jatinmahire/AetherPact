import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"

import math
import re
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(
    title="AetherPact API",
    description="B2B Hospitality Resource Matching & Automated Settlement Engine",
    version="1.1.0"
)

# 1. CORS middleware allowing all origins
# Note: For hackathon demo; restrict origins to authorized domains in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def parse_coords_from_text(text: Optional[str]) -> Optional[tuple]:
    """
    Extracts (latitude, longitude) from Google Maps URLs or coordinate strings.
    Handles formats:
    - https://www.google.com/maps/@19.0760,72.8777,15z
    - https://maps.google.com/?q=19.0760,72.8777
    - https://www.google.com/maps/place/.../@19.0760,72.8777...
    - Raw coordinates: "19.0760, 72.8777" or "19.0760 72.8777"
    """
    if not text:
        return None
    
    text = str(text).strip()
    
    # Check for @lat,lng
    at_match = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", text)
    if at_match:
        return float(at_match.group(1)), float(at_match.group(2))
    
    # Check for ?q=lat,lng or &q=lat,lng or ll=lat,lng or destination=lat,lng
    param_match = re.search(r"[?&](?:q|ll|destination)=(-?\d+\.\d+),(-?\d+\.\d+)", text)
    if param_match:
        return float(param_match.group(1)), float(param_match.group(2))
        
    # Check for raw coordinate numbers: "19.0760, 72.8777"
    raw_match = re.search(r"(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", text)
    if raw_match:
        return float(raw_match.group(1)), float(raw_match.group(2))
        
    return None

# 2. In-memory data store with realistic Mumbai hospitality venues & Google Maps URLs
listings: List[Dict[str, Any]] = [
    {
        "id": 1,
        "title": "Grand Ballroom, Hotel Sunrise",
        "description": "Spacious luxury banquet hall ideal for weddings, annual conferences, gala dinners, and large corporate events. Equipped with premium stage, acoustic insulation, and central AC.",
        "resource_type": "banquet_hall",
        "location_name": "Bandra Kurla Complex (BKC), Mumbai",
        "price": 15000.0,
        "capacity": 200,
        "lat": 19.0680,
        "lng": 72.8680,
        "google_maps_url": "https://www.google.com/maps?q=19.0680,72.8680"
    },
    {
        "id": 2,
        "title": "Commercial Kitchen, CloudBite Kitchens",
        "description": "Fully licensed commercial kitchen space with double deck ovens, stainless steel prep tables, high-capacity gas lines, walk-in cold storage, and catering prep zones.",
        "resource_type": "kitchen",
        "location_name": "Andheri East Industrial Area, Mumbai",
        "price": 25000.0,
        "capacity": 15,
        "lat": 19.1150,
        "lng": 72.8680,
        "google_maps_url": "https://www.google.com/maps?q=19.1150,72.8680"
    },
    {
        "id": 3,
        "title": "AV Equipment Set, EventPro Rentals",
        "description": "Professional event AV equipment package including line-array sound speakers, 4K digital projectors, stage lighting rigs, wireless microphones, and power distribution.",
        "resource_type": "av_equipment",
        "location_name": "Lower Parel Media Hub, Mumbai",
        "price": 8000.0,
        "capacity": 500,
        "lat": 19.0010,
        "lng": 72.8290,
        "google_maps_url": "https://www.google.com/maps?q=19.0010,72.8290"
    },
    {
        "id": 4,
        "title": "Shuttle Vans, Resort Meridian",
        "description": "Fleet of air-conditioned 14-seater luxury shuttle passenger vans suitable for airport transfers, event guest transport, and corporate delegate shuttles.",
        "resource_type": "vehicle",
        "location_name": "Chhatrapati Shivaji Airport Zone, Mumbai",
        "price": 6000.0,
        "capacity": 14,
        "lat": 19.0900,
        "lng": 72.8650,
        "google_maps_url": "https://www.google.com/maps?q=19.0900,72.8650"
    },
    {
        "id": 5,
        "title": "Rooftop Terrace, Hotel Bayview",
        "description": "Scenic open-air rooftop terrace and outdoor event space overlooking the skyline, perfect for cocktail parties, social mixers, sundowners, and wedding receptions.",
        "resource_type": "banquet_hall",
        "location_name": "Marine Drive Promenade, Mumbai",
        "price": 18000.0,
        "capacity": 120,
        "lat": 18.9430,
        "lng": 72.8230,
        "google_maps_url": "https://www.google.com/maps?q=18.9430,72.8230"
    }
]

# Pydantic models for request validation
class ListingCreate(BaseModel):
    title: str = Field(..., min_length=1)
    description: str = Field(..., min_length=1)
    resource_type: str = Field(...)
    price: float = Field(..., ge=0)
    capacity: int = Field(..., ge=0)
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = "Mumbai"
    google_maps_url: Optional[str] = None

class MatchRequest(BaseModel):
    description: str = Field(...)
    budget: float = Field(...)
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: Optional[str] = None
    google_maps_url: Optional[str] = None
    resource_type: Optional[str] = None

class NegotiateRequest(BaseModel):
    provider_min: float = Field(...)
    provider_ask: float = Field(...)
    seeker_offer: float = Field(...)
    seeker_max: float = Field(...)
    extra_terms: Optional[str] = None

# Haversine distance function (km)
def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0  # Earth's radius in kilometers
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

# 7. GET /health
@app.get("/health")
def get_health():
    """Uptime health check endpoint."""
    return {"status": "ok"}

# 4. GET /listings
@app.get("/listings")
def get_listings():
    """Returns the full list of current listings with Google Maps URLs."""
    for item in listings:
        if "google_maps_url" not in item or not item["google_maps_url"]:
            item["google_maps_url"] = f"https://www.google.com/maps?q={item['lat']},{item['lng']}"
    return listings

# 3. POST /listings
@app.post("/listings")
def create_listing(listing_in: ListingCreate):
    """
    Appends to listings with a new integer id and returns the created listing.
    Automatically parses coordinates from Google Maps URLs if provided.
    """
    lat = listing_in.lat
    lng = listing_in.lng
    maps_url = listing_in.google_maps_url

    # Auto-extract coordinates if Google Maps URL was pasted
    if maps_url:
        parsed = parse_coords_from_text(maps_url)
        if parsed:
            lat, lng = parsed

    # Default fallback to central Mumbai if neither provided
    if lat is None or lng is None:
        lat, lng = 19.0760, 72.8777

    # Ensure valid Google Maps URL exists
    if not maps_url:
        maps_url = f"https://www.google.com/maps?q={lat},{lng}"

    next_id = max([item["id"] for item in listings], default=0) + 1
    new_listing = {
        "id": next_id,
        "title": listing_in.title.strip(),
        "description": listing_in.description.strip(),
        "resource_type": listing_in.resource_type.strip(),
        "price": float(listing_in.price),
        "capacity": int(listing_in.capacity),
        "lat": float(lat),
        "lng": float(lng),
        "location_name": (listing_in.location_name or "Mumbai, India").strip(),
        "google_maps_url": maps_url
    }
    listings.append(new_listing)
    return new_listing

# 5. POST /match
@app.post("/match")
def match_listings(req: MatchRequest):
    """
    Computes live TF-IDF semantic cosine similarity, price fit, and Haversine distance.
    Accepts coordinates or parses them from a Google Maps URL.
    Applies soft filter for resource_type mismatch (0.5x multiplier).
    Returns top 5 matches with complete breakdown rounded to 3 decimal places.
    """
    if not listings:
        return {"matches": []}

    req_lat = req.lat
    req_lng = req.lng

    # If Google Maps URL or location text provided, attempt to extract coordinates
    if req.google_maps_url:
        parsed = parse_coords_from_text(req.google_maps_url)
        if parsed:
            req_lat, req_lng = parsed

    # Default to Mumbai center if no coordinates provided
    if req_lat is None or req_lng is None:
        req_lat, req_lng = 19.0760, 72.8777

    # a. TF-IDF matrix over [req.description] + [listing.description for each listing]
    descriptions = [req.description] + [item["description"] for item in listings]

    try:
        vectorizer = TfidfVectorizer(stop_words="english", token_pattern=r"(?u)\b\w+\b")
        tfidf_matrix = vectorizer.fit_transform(descriptions)
        # b. Cosine similarity between requirement (row 0) and each listing (rows 1..N)
        sim_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
    except Exception:
        sim_scores = [0.0] * len(listings)

    scored_matches = []

    for idx, listing in enumerate(listings):
        # b. semantic_score (0.0 to 1.0)
        semantic_score = float(sim_scores[idx]) if idx < len(sim_scores) else 0.0
        semantic_score = max(0.0, min(1.0, semantic_score))

        # c. price_score
        if req.budget <= 0:
            price_score = 0.5
        else:
            price_score = max(0.0, 1.0 - abs(listing["price"] - req.budget) / req.budget)

        # d. distance_km and distance_score
        distance_km = haversine_km(req_lat, req_lng, listing["lat"], listing["lng"])
        distance_score = max(0.0, 1.0 - distance_km / 10.0)

        # f. Compute raw final score
        raw_final_score = 0.5 * semantic_score + 0.3 * price_score + 0.2 * distance_score

        # e. Soft filter: 0.5x multiplier if resource_type provided and does not match
        filter_multiplier = 1.0
        if req.resource_type and req.resource_type.strip():
            selected_type = req.resource_type.strip().lower()
            if selected_type not in ["any", "all", ""]:
                listing_type = listing.get("resource_type", "").strip().lower()
                if selected_type != listing_type:
                    filter_multiplier = 0.5

        final_score = raw_final_score * filter_multiplier

        # Ensure listing has a valid Google Maps URL
        maps_link = listing.get("google_maps_url") or f"https://www.google.com/maps?q={listing['lat']},{listing['lng']}"

        scored_matches.append({
            "listing": {
                **listing,
                "google_maps_url": maps_link
            },
            "final_score": round(final_score, 3),
            "breakdown": {
                "semantic": round(semantic_score, 3),
                "price_fit": round(price_score, 3),
                "distance": round(distance_score, 3),
                "distance_km": round(distance_km, 3)
            }
        })

    # g. Sort listings by final_score descending and return top 5
    scored_matches.sort(key=lambda x: x["final_score"], reverse=True)
    top_matches = scored_matches[:5]

    return {"matches": top_matches}

# 6. POST /negotiate
@app.post("/negotiate")
def negotiate(req: NegotiateRequest):
    """
    Deterministic Zone-of-Possible-Agreement (ZOPA) clearing engine.
    Computes exact midpoint clearing price or returns no_deal.
    Labeled as Automated Settlement Engine (no LLM).
    """
    lower_bound = max(req.provider_min, req.seeker_offer)
    upper_bound = min(req.provider_ask, req.seeker_max)

    if lower_bound > upper_bound:
        return {
            "status": "no_deal",
            "message": "No overlapping price range was found between the two parties. Try adjusting the offer or budget."
        }

    clearing_price = round((lower_bound + upper_bound) / 2.0, 2)
    summary = f"Settled at Rs.{clearing_price}."
    if req.extra_terms and req.extra_terms.strip():
        summary += f" Terms: {req.extra_terms.strip()}."

    return {
        "status": "settled",
        "clearing_price": clearing_price,
        "summary": summary
    }
