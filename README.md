# AetherPact 🌐🤝

> **Autonomous B2B Hospitality Resource Exchange & Bilateral Settlement Network**

[![Live Demo](https://img.shields.io/badge/Live_Website-aether--pact.vercel.app-0070f3?style=for-the-badge&logo=vercel&logoColor=white)](https://aether-pact.vercel.app/)
[![FastAPI](https://img.shields.io/badge/Backend-FastAPI_0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.11_|_3.12-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![scikit-learn](https://img.shields.io/badge/AI_Engine-scikit--learn-F7931E?style=for-the-badge&logo=scikit-learn&logoColor=white)](https://scikit-learn.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

---

## 📖 Abstract & Executive Summary

The commercial hospitality industry suffers from an acute **$45B+ idle capacity problem**. Luxury banquet halls sit dark between weekend weddings, licensed commercial cloud kitchens remain dormant during off-peak meal hours, and high-end AV equipment or executive shuttle fleets sit unused between major conferences. Concurrently, independent event planners, pop-up restaurateurs, and corporate coordinators face opaque pricing, days of tedious broker back-and-forth, and fragmented location searches.

**AetherPact** bridges this gap by creating an autonomous, dual-sided B2B resource clearing network. Rather than relying on static classified ads or manual broker negotiations, AetherPact pairs **real-time semantic AI matching** (TF-IDF vectorization and cosine similarity) with **geospatial proximity scoring** (Haversine distance) and **Google Maps intelligence**. 

When a seeker identifies a potential venue or asset, negotiations are not left to high-friction messaging: parties enter their reservation limits into an **Automated Settlement Engine** powered by deterministic **Zone of Possible Agreement (ZOPA)** game-theoretic mathematics. Deals are cleared at the exact fair midpoint in milliseconds with zero bias, mathematical proof of surplus, and zero hallucination risk.

---

## 🚀 Live Platform & Quick Links

| Resource | Link | Description |
| :--- | :--- | :--- |
| **🌐 Production Web App** | **[https://aether-pact.vercel.app/](https://aether-pact.vercel.app/)** | Instant live access to the AetherPact platform |
| **🐙 GitHub Repository** | **[jatinmahire/AetherPact](https://github.com/jatinmahire/AetherPact)** | Open-source codebase, backend, and documentation |
| **📚 Interactive API Docs** | `http://127.0.0.1:8000/docs` | Live OpenAPI / Swagger documentation (when running locally) |

---

## 🔑 Pre-Seeded Demo Credentials

The platform includes real token-based authentication (`POST /login`, `POST /register`, `GET /me`) with pre-seeded accounts for immediate testing:

| Role | Email | Password | Pre-configured Profile |
| :--- | :--- | :--- | :--- |
| **Host / Provider** | `provider@aetherpact.com` | `password123` | Sunrise Hospitality Host (Bandra / BKC) |
| **Buyer / Seeker** | `seeker@aetherpact.com` | `password123` | Apex Event Planners (Corporate & Weddings) |
| **Guest / Public** | *No login needed* | *N/A* | Browse directory, view Google Maps links, run AI search |

> 💡 **Seamless Continuation**: When browsing as a guest, clicking **"Negotiate with Host"** prompts a one-click login and automatically redirects you directly into the bilateral settlement session with asset details pre-loaded!

---

## ✨ Key Capabilities & Highlights

### 1. 🔍 Multi-Factor Semantic AI Matching (`POST /match`)
- **Semantic Text Understanding**: Evaluates natural-language event requirements (e.g., *"Need commercial cold storage and prep counters for a high-volume catering event near Bandra"*) against all active listings via term frequency-inverse document frequency (`TfidfVectorizer`) and cosine similarity.
- **Geospatial Proximity**: Computes real-world distances across Mumbai neighborhoods using the spherical Haversine formula.
- **Budget Fit & Category Balancing**: Balances pricing tolerance against host asking rates with soft penalties for category cross-overs.

### 2. 📍 Google Maps Deep Integration
- **Zero Coordinate Friction**: Users never enter raw latitude or longitude.
- **Smart URL Parsing**: Paste any Google Maps link (`https://maps.app.goo.gl/...` or `https://google.com/maps?q=lat,lng`) and coordinates are parsed instantly in real time.
- **Mumbai Hub Quick-Chips**: One-click selection for high-demand business clusters (*BKC, Bandra West, Andheri East, Marine Drive, Juhu, Lower Parel*).
- **Interactive Redirects**: Every listing and match result includes a **"📍 View on Google Maps ↗"** button that opens the real location.

### 3. ⚖️ Deterministic ZOPA Settlement Engine (`POST /negotiate`)
- Bilateral terms are cleared using game-theoretic mathematics:
  - Validates overlap: $\text{Lower Bound} \le \text{Upper Bound}$
  - Calculates clearing price: $\text{Clearing Price} = \frac{\text{Lower Bound} + \text{Upper Bound}}{2}$
  - Computes exact economic surplus generated for both the host and the seeker.
- **Transparent & Explainable**: Labeled clearly as an *Automated Settlement Engine*—not an LLM—because financial contracts demand deterministic mathematical proof.

### 4. 🛡️ Role-Based Portals & Authentication
- **Provider Portal (`#provider`)**: Gated to authenticated hosts. Manage active hospitality assets, monitor community listings, and publish inventory with custom pricing and location hubs.
- **Seeker Portal (`#seeker`)**: Natural language discovery, instant match percentages, score breakdowns, and integrated negotiation triggers.
- **RBAC Enforcement**: Server-side permission gating returns `HTTP 401 Unauthorized` or `HTTP 403 Forbidden` if unauthorized roles attempt privileged operations.

---

## 📐 Mathematical Formulation

### A. Multi-Factor Scoring Formula
Every recommendation score $S_{\text{final}} \in [0.0, 1.0]$ is computed live from scratch:

$$S_{\text{final}} = \left( 0.50 \cdot S_{\text{semantic}} + 0.30 \cdot S_{\text{budget}} + 0.20 \cdot S_{\text{proximity}} \right) \times M_{\text{type}}$$

Where:
- **$S_{\text{semantic}}$**: $\cos(\vec{u}_{\text{query}}, \vec{v}_{\text{listing}})$ computed over the scikit-learn TF-IDF matrix.
- **$S_{\text{budget}}$**: $\max\left(0, 1 - \frac{|\text{Price} - \text{Budget}|}{\text{Budget}}\right)$
- **$S_{\text{proximity}}$**: $\max\left(0, 1 - \frac{d_{\text{km}}}{10}\right)$, where $d_{\text{km}}$ is the Haversine spherical distance:
  $$d = 2R \arcsin \left( \sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)} \right)$$
- **$M_{\text{type}}$**: Category penalty multiplier ($1.0\times$ for exact category match, $0.5\times$ for soft crossover).

### B. ZOPA Clearing Formulation
Given:
- Host Ask Price $P_{\text{ask}}$ and Host Walkaway Floor $P_{\text{floor}}$
- Seeker Offer Price $P_{\text{offer}}$ and Seeker Budget Ceiling $P_{\text{ceiling}}$

$$\text{Lower Bound} = \max(P_{\text{floor}}, P_{\text{offer}})$$
$$\text{Upper Bound} = \min(P_{\text{ask}}, P_{\text{ceiling}})$$

- If $\text{Lower Bound} > \text{Upper Bound} \implies$ **NO DEAL** (Actionable gap feedback provided).
- If $\text{Lower Bound} \le \text{Upper Bound} \implies$ **SETTLED**:
  $$P_{\text{clearing}} = \frac{\text{Lower Bound} + \text{Upper Bound}}{2}$$

---

## 🏛️ System Architecture

```text
               +---------------------------------------------+
               |        AetherPact Web Application           |
               |  (Landing Page | Seeker Hub | Host Portal)  |
               +----------------------+----------------------+
                                      |
                      REST / JSON API | Authorization: Bearer <token>
                                      v
               +---------------------------------------------+
               |         FastAPI High-Performance Core        |
               |  CORS Middleware | Router | Auth Middleware |
               +----------------------+----------------------+
                                      |
         +----------------------------+----------------------------+
         |                                                         |
         v                                                         v
+-----------------------------+                           +-----------------------------+
|    AI Matchmaking Engine    |                           |  Automated Settlement Core  |
|  - scikit-learn TF-IDF      |                           |  - ZOPA Midpoint Solver     |
|  - Cosine Vector Distance   |                           |  - Surplus Allocator        |
|  - Haversine Geospatial     |                           |  - Boundary Verification    |
+-----------------------------+                           +-----------------------------+
                                      |
                                      v
               +---------------------------------------------+
               |              In-Memory Store                |
               |  - User Registry & Token Table              |
               |  - Mumbai Hospitality Asset Seed Catalog    |
               +---------------------------------------------+
```

---

## 📁 Repository Structure

```text
AetherPact/
├── backend/
│   ├── main.py              # FastAPI server, TF-IDF matcher, ZOPA settlement, Auth API
│   ├── requirements.txt     # fastapi, uvicorn, scikit-learn, python-multipart
│   └── Procfile             # Render production deployment start command
├── frontend/
│   ├── index.html           # Landing page, role portals, auth modal, settlement view
│   ├── style.css            # Humanized CSS design system, typography, animations
│   └── script.js            # Auth state, Google Maps parser, API client, view router
├── netlify.toml             # Netlify static hosting configuration
├── vercel.json              # Vercel static hosting configuration
└── README.md                # Comprehensive documentation
```

---

## 💻 Local Setup & Quickstart

### 1. Clone the Repository
```bash
git clone https://github.com/jatinmahire/AetherPact.git
cd AetherPact
```

### 2. Launch the Backend API
```bash
# Navigate to backend directory
cd backend

# Create virtual environment and install dependencies
python -m venv .venv
source .venv/bin/activate       # On Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Start the uvicorn development server
uvicorn main:app --reload --port 8000
```
- API Server: `http://127.0.0.1:8000`
- API Documentation: `http://127.0.0.1:8000/docs`

### 3. Launch the Frontend
In a new terminal window:
```bash
# Serve static frontend files
python -m http.server 3000 --directory frontend
```
- Open `http://127.0.0.1:3000` in any web browser.

---

## 📡 REST API Reference

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/register` | Public | Register new user account (`email`, `password`, `name`, `role`) |
| `POST` | `/login` | Public | Authenticate user credentials and receive `Bearer` token |
| `GET` | `/me` | Authenticated | Fetch active user profile from `Authorization: Bearer <token>` |
| `GET` | `/listings` | Public | Retrieve all published community hospitality assets |
| `POST` | `/listings` | **Provider Only** | Create and publish a new hospitality asset listing |
| `POST` | `/match` | Public | Run live TF-IDF semantic and geospatial match against listings |
| `POST` | `/negotiate` | **Authenticated** | Execute deterministic bilateral ZOPA settlement calculation |
| `GET` | `/` | Public | Service root status and quick documentation links |
| `GET` | `/health` | Public | Service health verification and system status check |

---

## ☁️ Live Cloud Deployment (Render & Vercel)

AetherPact is pre-configured for instant zero-config deployment across **Render** (FastAPI backend) and **Vercel** (static frontend).

### 1. Deploy the Backend on Render
1. Create an account on [Render](https://render.com/).
2. Click **New +** &rarr; **Blueprint** (or **Web Service**):
   - **Using Blueprint (Recommended)**: Connect your `AetherPact` repository. Render will automatically detect [`render.yaml`](file:///render.yaml) and configure build and start commands.
   - **Manual Web Service Setup**:
     - **Repository**: `https://github.com/jatinmahire/AetherPact`
     - **Runtime**: `Python 3`
     - **Root Directory**: `backend`
     - **Build Command**: `pip install -r requirements.txt`
     - **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
     - **Health Check Path**: `/health`
3. Click **Deploy Web Service**. Once deployed, copy your live backend URL (e.g., `https://aetherpact-backend.onrender.com`).

### 2. Deploy the Frontend on Vercel
1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New...** &rarr; **Project** and import the `AetherPact` GitHub repository.
3. The project includes [`vercel.json`](file:///vercel.json) pre-configured with `"outputDirectory": "frontend"`.
4. Click **Deploy**. Your frontend is now live at `https://your-project.vercel.app` (e.g., `https://aether-pact.vercel.app`).

### 3. Connect Frontend to Render Backend
You can link your live Vercel frontend to your Render backend in any of three easy ways:
- **Instant URL Parameter**: Open your live Vercel URL with `?api=https://your-app.onrender.com` (e.g., `https://aether-pact.vercel.app?api=https://aetherpact-backend.onrender.com`). It automatically stores the URL in browser `localStorage`!
- **Browser Console**: Run `setBackendUrl("https://your-app.onrender.com")` in DevTools.
- **Direct in Code**: Set `const API_BASE = "https://your-app.onrender.com";` at the top of [`frontend/script.js`](file:///frontend/script.js).


---

## 🧠 Evaluator & Judge Q&A

<details>
<summary><b>Q1: Why TF-IDF plus cosine similarity instead of a heavyweight transformer (MiniLM / BERT)?</b></summary>
<br>
<i>Deliberate engineering decision.</i> MiniLM and PyTorch require >800MB in build packages, slow down deployment cycles, and routinely exceed free-tier cloud memory limits. TF-IDF is lightweight, blazingly fast (<10ms vectorization), and mathematically genuine. The modular design decouples vector generation from scoring, meaning sentence transformers or embedding models can be swapped in without modifying any frontend or database contracts.
</details>

<details>
<summary><b>Q2: Why is the negotiation solver not powered by an LLM?</b></summary>
<br>
<i>Financial clearing demands zero hallucination.</i> While an LLM is suitable for conversational prose, contract pricing and financial settlements must be 100% deterministic, explainable, and game-theoretically sound. Using the ZOPA midpoint solver ensures that neither party is ever breached outside their walkaway conditions.
</details>

<details>
<summary><b>Q3: How are Google Maps links handled without external geocoding API keys?</b></summary>
<br>
The client and server incorporate robust regex parsers that extract `@lat,lng` and `?q=lat,lng` coordinates directly from Google Maps URLs and share links. Combined with popular Mumbai business cluster presets and browser HTML5 geolocation, users get a seamless location experience without entering decimal coordinates.
</details>

---

## 📄 License

This project is licensed under the **MIT License**. Feel free to use, inspect, and build upon it.

Built with ❤️ for frictionless B2B hospitality resource exchange.
