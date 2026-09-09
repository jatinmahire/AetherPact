# AetherPact — B2B Hospitality Resource Matching & Automated Settlement MVP

AetherPact is an MVP built for B2B hospitality resource sharing (venues, commercial kitchens, AV equipment, shuttle fleets). It features live TF-IDF semantic matching, multi-factor scoring, and a deterministic Zone-of-Possible-Agreement (ZOPA) settlement engine.

> **Non-Negotiable Rule**: Every score, ranking, and price is computed live from real user input. Nothing is hardcoded, randomized, or faked.

---

## Architecture & Tech Stack

- **Backend**: Python 3.12, FastAPI, scikit-learn (`TfidfVectorizer`, `cosine_similarity`), uvicorn.
- **Storage**: In-memory data store (`listings` list seeded with 5 hospitality assets in Mumbai).
- **Frontend**: Single static website (`index.html`, `style.css`, `script.js`). No build steps, no npm, zero deployment failure risk.
- **Hosting Targets**:
  - **Backend**: Render.com (free tier) using `backend/Procfile` or start command.
  - **Frontend**: Netlify (via drag-and-drop manual deploy or GitHub integration).

---

## Folder Structure

```text
Demo/
├── backend/
│   ├── main.py              # FastAPI application with match & negotiation logic
│   ├── requirements.txt     # fastapi, uvicorn, scikit-learn, python-multipart
│   └── Procfile             # web: uvicorn main:app --host 0.0.0.0 --port $PORT
├── frontend/
│   ├── index.html           # 3-tab static UI (Provider, Seeker, Settlement)
│   ├── style.css            # Navy #3A4876, Lavender #C7CEEA, responsive styling
│   └── script.js            # Pure JS fetch integration & tab controllers
└── README.md
```

---

## Live Algorithmic Logic

### 1. Multi-Factor Resource Matching (`POST /match`)
- **Corpus TF-IDF Matrix**: Constructs term frequency-inverse document frequency matrix over `[seeker_description] + [all_listing_descriptions]`.
- **Semantic Score (50% weight)**: Cosine similarity between requirement vector (row 0) and listing vectors (rows 1..N), ranging from 0.0 to 1.0.
- **Budget Fit Score (30% weight)**:
  $$\text{price\_score} = \max\left(0, 1 - \frac{|\text{listing.price} - \text{budget}|}{\text{budget}}\right)$$
  *(Defaults to 0.5 if budget $\le$ 0)*
- **Proximity Score (20% weight)**:
  Calculates Haversine spherical distance $d$ in kilometers.
  $$\text{distance\_score} = \max\left(0, 1 - \frac{d}{10}\right)$$
- **Soft Type Multiplier**: If seeker specifies a resource type that does not match a listing, the final score receives a **0.5x multiplier** (soft ranking penalty, not strict exclusion).
- **Top 5 Ranking**: Returns top 5 matches sorted by `final_score` descending, with exact 3-decimal score breakdowns.

### 2. Automated Settlement Engine (`POST /negotiate`)
- Pure deterministic Zone of Possible Agreement (ZOPA) solver:
  $$\text{lower\_bound} = \max(\text{provider\_min}, \text{seeker\_offer})$$
  $$\text{upper\_bound} = \min(\text{provider\_ask}, \text{seeker\_max})$$
- If $\text{lower\_bound} > \text{upper\_bound}$, returns `status: "no_deal"` with actionable feedback.
- If $\text{lower\_bound} \le \text{upper\_bound}$, returns `status: "settled"` with:
  $$\text{clearing\_price} = \text{round}\left(\frac{\text{lower\_bound} + \text{upper\_bound}}{2}, 2\right)$$
- Summarized as: `Settled at Rs.<price>. [Terms: <extra_terms>]`
- **Notice**: Labeled as **"Automated Settlement Engine"**, not AI, because it is deterministic mathematics.

---

## Local Development & Testing

### 1. Run the Backend
```bash
# In project root:
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Backend will run at: `http://127.0.0.1:8000`
Health check: `http://127.0.0.1:8000/health`
Interactive Swagger docs: `http://127.0.0.1:8000/docs`

### 2. Run the Frontend
Simply open `frontend/index.html` directly in your browser, or serve it using Python:
```bash
python -m http.server 3000 --directory frontend
```
Open `http://127.0.0.1:3000` in your web browser.

---

## Deployment Guide

### A. Deploy Backend to Render
1. Push this repository to GitHub.
2. In [Render Dashboard](https://dashboard.render.com/):
   - Click **New +** &rarr; **Web Service**.
   - Connect your GitHub repository.
   - Set **Root Directory** to `backend`.
   - Set **Runtime** to `Python 3`.
   - Set **Build Command**: `pip install -r requirements.txt`
   - Set **Start Command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Select **Free** instance type.
   - Click **Deploy Web Service**.
3. Copy your deployed service URL (e.g., `https://aetherpact-backend.onrender.com`).
4. *Important*: Render's free tier spins down on inactivity. Before demos or judging, open `https://<your-service>.onrender.com/health` in a browser tab a few minutes prior to wake it up.

### B. Deploy Frontend to Vercel (Recommended & Instant)
1. Go to [Vercel Dashboard](https://vercel.com/new).
2. Import your GitHub repository: `jatinmahire/AetherPact`.
3. Vercel will automatically detect `vercel.json` and configure `frontend` as the output directory.
4. Click **Deploy**. Your site is live instantly with an `*.vercel.app` URL!

### C. Deploy Frontend to Netlify
1. Go to [Netlify Dashboard](https://app.netlify.com/).
2. Drag and drop the `frontend` folder directly into Netlify's **Deploy manually** zone (fastest, zero git setup required).
3. Or click **Add new site** &rarr; **Import an existing project** &rarr; Connect `jatinmahire/AetherPact`.
   - Netlify will automatically detect `netlify.toml` and set the publish directory to `frontend`.
4. Click **Deploy site**. Your site will be live on an `*.netlify.app` URL.

---

## Judge Q&A Cheat Sheet

- **Why TF-IDF instead of a heavy transformer (e.g. MiniLM / BERT)?**
  *Response*: Scoped deliberately for fast, zero-failure free-tier hosting limits and instant build times. The modular architecture computes vectors cleanly, making it trivial to swap in sentence transformers or embeddings in production without altering the schema or UI.
- **Why is there no LLM in the negotiation engine?**
  *Response*: Bilateral financial clearing and pricing settlements require deterministic guarantees and explainable arithmetic, not non-deterministic hallucination risk. Keeping math out of LLM hands was an intentional architectural choice.
