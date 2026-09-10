import os
os.environ["OPENBLAS_NUM_THREADS"] = "1"
os.environ["OMP_NUM_THREADS"] = "1"

import math
import re
import secrets
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, Header
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = FastAPI(
    title="AetherPact API",
    description="B2B Hospitality Resource Matching & Automated Settlement Engine with Role Authentication",
    version="2.0.0"
)

# 1. CORS middleware allowing cross-origin requests from Vercel deployments, localhost, and custom domains
cors_origins_env = os.getenv("CORS_ORIGINS", "")
if cors_origins_env:
    origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Default permissive CORS for hackathon & multi-domain deployment (Vercel frontend + Render backend)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/")
def root():
    """Service status and quick links for Render deployments."""
    return {
        "service": "AetherPact API",
        "status": "online",
        "version": "2.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
def health_check():
    """Lightweight keep-alive health check endpoint for Render and UptimeRobot."""
    import time
    return {
        "status": "ok",
        "service": "AetherPact API",
        "timestamp": int(time.time()),
        "uptime": "online"
    }



# ====================================================================
# IN-MEMORY DATA STORES & SECURITY DISCLOSURE
# ====================================================================

# SECURITY NOTE: For this hackathon demo, passwords are stored as plain text in the in-memory
# user store. In a production deployment, passwords MUST be cryptographically hashed
# (e.g., using bcrypt or argon2 with unique salts) before storage.
users: List[Dict[str, Any]] = [
    {
        "id": 1,
        "name": "Sunrise Hospitality Host",
        "email": "provider@aetherpact.com",
        "password": "password123",
        "role": "provider"
    },
    {
        "id": 2,
        "name": "Apex Event Planners",
        "email": "seeker@aetherpact.com",
        "password": "password123",
        "role": "seeker"
    }
]

# In-memory token store: token string -> user id
tokens: Dict[str, int] = {}

def get_current_user(request: Request) -> Optional[Dict[str, Any]]:
    """Helper to authenticate requests using Bearer <token> in Authorization header."""
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        return None
    
    parts = auth_header.strip().split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
        
    token = parts[1]
    user_id = tokens.get(token)
    if not user_id:
        return None
        
    for u in users:
        if u["id"] == user_id:
            return u
    return None

def sanitize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Returns user dict without exposing password."""
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"]
    }

# ====================================================================
# AUTHENTICATION ENDPOINTS
# ====================================================================

class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=1)
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=4)
    role: str = Field(...)  # "provider" or "seeker"

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)

@app.post("/register")
def register(req: RegisterRequest):
    """Registers a new user and returns a session token."""
    email_clean = req.email.strip().lower()
    
    # Check for duplicate email
    if any(u["email"].lower() == email_clean for u in users):
        return JSONResponse(status_code=400, content={"error": "Email already registered"})
        
    role_clean = req.role.strip().lower()
    if role_clean not in ["provider", "seeker"]:
        role_clean = "seeker"

    user_id = max([u["id"] for u in users], default=0) + 1
    new_user = {
        "id": user_id,
        "name": req.name.strip(),
        "email": email_clean,
        "password": req.password,
        "role": role_clean
    }
    users.append(new_user)
    
    # Issue authentication token
    token = secrets.token_hex(16)
    tokens[token] = user_id
    
    return {
        "token": token,
        "user": sanitize_user(new_user)
    }

@app.post("/login")
def login(req: LoginRequest):
    """Authenticates a user by email and password, issuing a new session token."""
    email_clean = req.email.strip().lower()
    
    user = next((u for u in users if u["email"].lower() == email_clean), None)
    if not user or user["password"] != req.password:
        return JSONResponse(status_code=401, content={"error": "Invalid email or password"})
        
    token = secrets.token_hex(16)
    tokens[token] = user["id"]
    
    return {
        "token": token,
        "user": sanitize_user(user)
    }

@app.get("/me")
def get_me(request: Request):
    """Returns profile for currently authenticated user."""
    user = get_current_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Not authenticated"})
    return sanitize_user(user)

# ====================================================================
# HOSPITALITY LISTINGS STORE & COORDINATE UTILITIES
# ====================================================================

def parse_coords_from_text(text: Optional[str]) -> Optional[tuple]:
    """Extracts (lat, lng) from Google Maps URLs or coordinate strings."""
    if not text:
        return None
    text = str(text).strip()
    at_match = re.search(r"@(-?\d+\.\d+),(-?\d+\.\d+)", text)
    if at_match:
        return float(at_match.group(1)), float(at_match.group(2))
    param_match = re.search(r"[?&](?:q|ll|destination)=(-?\d+\.\d+),(-?\d+\.\d+)", text)
    if param_match:
        return float(param_match.group(1)), float(param_match.group(2))
    raw_match = re.search(r"(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)", text)
    if raw_match:
        return float(raw_match.group(1)), float(raw_match.group(2))
    return None

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

def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) *
         math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

# 7. GET /health (Public)
@app.get("/health")
def get_health():
    """Uptime health check endpoint."""
    return {"status": "ok"}

# 4. GET /listings (Public)
@app.get("/listings")
def get_listings():
    """Returns the full list of current listings with Google Maps URLs (Public)."""
    for item in listings:
        if "google_maps_url" not in item or not item["google_maps_url"]:
            item["google_maps_url"] = f"https://www.google.com/maps?q={item['lat']},{item['lng']}"
    return listings

# 3. POST /listings (Protected: Provider token required)
@app.post("/listings")
def create_listing(listing_in: ListingCreate, request: Request):
    """
    Creates a new listing.
    Requires a valid token and user.role == 'provider'.
    """
    user = get_current_user(request)
    if not user:
        return JSONResponse(status_code=401, content={"error": "Please log in as a provider to list a resource"})
        
    if user["role"] != "provider":
        return JSONResponse(status_code=403, content={"error": "Only provider accounts can list resources"})

    lat = listing_in.lat
    lng = listing_in.lng
    maps_url = listing_in.google_maps_url

    if maps_url:
        parsed = parse_coords_from_text(maps_url)
        if parsed:
            lat, lng = parsed

    if lat is None or lng is None:
        lat, lng = 19.0760, 72.8777

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
        "google_maps_url": maps_url,
        "provider_id": user["id"]
    }
    listings.append(new_listing)
    return new_listing

# ====================================================================
# AI INSIGHTS & EXPLANATION GENERATORS (DETERMINISTIC NUMERICAL REASONING)
# ====================================================================

def compute_confidence_label(final_score: float) -> str:
    """Computes categorical confidence label based on deterministic final_score thresholds."""
    if final_score >= 0.75:
        return "Strong Match"
    elif final_score >= 0.5:
        return "Good Match"
    elif final_score >= 0.3:
        return "Partial Match"
    else:
        return "Weak Match"

def generate_match_insight(breakdown: Dict[str, Any], final_score: float) -> str:
    """
    Generates deterministic explanation string based on computed breakdown scores:
    semantic, price_fit, and distance. Pure logic on real numbers (no LLM, no randomness).
    """
    components = {
        "semantic": float(breakdown.get("semantic", 0.0)),
        "price_fit": float(breakdown.get("price_fit", 0.0)),
        "distance": float(breakdown.get("distance", 0.0))
    }

    highest_comp = max(components, key=components.get)
    lowest_comp = min(components, key=components.get)

    highest_templates = {
        "semantic": "This listing's description closely matches what you described.",
        "price_fit": "This listing's price is very close to your stated budget.",
        "distance": "This is one of the closest available options to your location."
    }

    lowest_templates = {
        "semantic": "The description overlap with your request is weaker than other matches.",
        "price_fit": "This option is further from your stated budget than others.",
        "distance": "This option is farther from your location than others."
    }

    sentences = [highest_templates[highest_comp]]

    # Only append the lowest sentence if its score is below 0.5 and it is not the exact same component
    if components[lowest_comp] < 0.5 and lowest_comp != highest_comp:
        sentences.append(lowest_templates[lowest_comp])

    return " ".join(sentences)

def generate_negotiation_insight(provider_ask: float, seeker_offer: float, clearing_price: float) -> str:
    """
    Computes real movements from initial positions and generates an objective explanation
    of which party conceded more. Pure arithmetic on real numbers.
    """
    provider_movement = round(abs(provider_ask - clearing_price), 2)
    seeker_movement = round(abs(seeker_offer - clearing_price), 2)

    def _fmt(val: float) -> str:
        return f"₹{int(val):,}" if val.is_integer() else f"₹{val:,.2f}"

    if provider_movement > seeker_movement:
        return f"The provider moved further from their initial ask ({_fmt(provider_movement)}) than the seeker did from their initial offer ({_fmt(seeker_movement)})."
    elif seeker_movement > provider_movement:
        return f"The seeker moved further from their initial offer ({_fmt(seeker_movement)}) than the provider did from their initial ask ({_fmt(provider_movement)})."
    else:
        return f"Both parties conceded equally, each moving {_fmt(seeker_movement)} from their opening positions."

# 5. POST /match (Public)
@app.post("/match")
def match_listings(req: MatchRequest):
    """
    Computes live TF-IDF semantic cosine similarity, price fit, and Haversine distance (Public).
    Augments each match with deterministic AI insight reasoning and confidence label.
    """
    if not listings:
        return {"matches": []}

    req_lat = req.lat
    req_lng = req.lng

    if req.google_maps_url:
        parsed = parse_coords_from_text(req.google_maps_url)
        if parsed:
            req_lat, req_lng = parsed

    if req_lat is None or req_lng is None:
        req_lat, req_lng = 19.0760, 72.8777

    descriptions = [req.description] + [item["description"] for item in listings]

    try:
        vectorizer = TfidfVectorizer(stop_words="english", token_pattern=r"(?u)\b\w+\b")
        tfidf_matrix = vectorizer.fit_transform(descriptions)
        sim_scores = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
    except Exception:
        sim_scores = [0.0] * len(listings)

    scored_matches = []

    for idx, listing in enumerate(listings):
        semantic_score = float(sim_scores[idx]) if idx < len(sim_scores) else 0.0
        semantic_score = max(0.0, min(1.0, semantic_score))

        if req.budget <= 0:
            price_score = 0.5
        else:
            price_score = max(0.0, 1.0 - abs(listing["price"] - req.budget) / req.budget)

        distance_km = haversine_km(req_lat, req_lng, listing["lat"], listing["lng"])
        distance_score = max(0.0, 1.0 - distance_km / 10.0)

        raw_final_score = 0.5 * semantic_score + 0.3 * price_score + 0.2 * distance_score

        filter_multiplier = 1.0
        if req.resource_type and req.resource_type.strip():
            selected_type = req.resource_type.strip().lower()
            if selected_type not in ["any", "all", ""]:
                listing_type = listing.get("resource_type", "").strip().lower()
                if selected_type != listing_type:
                    filter_multiplier = 0.5

        final_score = raw_final_score * filter_multiplier
        maps_link = listing.get("google_maps_url") or f"https://www.google.com/maps?q={listing['lat']},{listing['lng']}"

        breakdown_data = {
            "semantic": round(semantic_score, 3),
            "price_fit": round(price_score, 3),
            "distance": round(distance_score, 3),
            "distance_km": round(distance_km, 3)
        }
        rounded_final_score = round(final_score, 3)

        insight_text = generate_match_insight(breakdown_data, rounded_final_score)
        confidence_lbl = compute_confidence_label(rounded_final_score)

        scored_matches.append({
            "listing": {
                **listing,
                "google_maps_url": maps_link
            },
            "final_score": rounded_final_score,
            "confidence_label": confidence_lbl,
            "insight": insight_text,
            "breakdown": breakdown_data
        })

    scored_matches.sort(key=lambda x: x["final_score"], reverse=True)
    top_matches = scored_matches[:5]

    return {"matches": top_matches}

# 6. POST /negotiate (Protected: Any authenticated user)
@app.post("/negotiate")
def negotiate(req: NegotiateRequest, request: Request):
    """
    Deterministic Zone-of-Possible-Agreement (ZOPA) clearing engine.
    Requires a valid token (seeker or provider).
    Includes deterministic negotiation_insight explaining party concessions.
    """
    user = get_current_user(request)
    if not user:
        return JSONResponse(
            status_code=401, 
            content={"error": "Please log in or register to continue with this rental request"}
        )

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

    negotiation_insight = generate_negotiation_insight(
        provider_ask=req.provider_ask,
        seeker_offer=req.seeker_offer,
        clearing_price=clearing_price
    )

    return {
        "status": "settled",
        "clearing_price": clearing_price,
        "summary": summary,
        "negotiation_insight": negotiation_insight
    }
