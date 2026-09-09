const API_BASE = "PASTE_YOUR_RENDER_BACKEND_URL_HERE";

/**
 * Resolves active backend API root.
 * Falls back to http://127.0.0.1:8000 for local development.
 */
function getApiRoot() {
  if (API_BASE && API_BASE !== "PASTE_YOUR_RENDER_BACKEND_URL_HERE" && API_BASE.trim() !== "") {
    return API_BASE.replace(/\/+$/, "");
  }
  return "http://127.0.0.1:8000";
}

// Global Auth State
let currentToken = localStorage.getItem("aether_token") || null;
let currentUser = null;
try {
  const storedUser = localStorage.getItem("aether_user");
  if (storedUser) currentUser = JSON.parse(storedUser);
} catch (_) {
  currentUser = null;
}

// Pending action callback upon authentication
let pendingAuthCallback = null;

// DOM References: Views
const viewLanding = document.getElementById("view-landing");
const viewProvider = document.getElementById("view-provider");
const viewSeeker = document.getElementById("view-seeker");
const seekerSearchView = document.getElementById("seeker-search-view");
const seekerNegotiateView = document.getElementById("seeker-negotiate-view");

// Navigation & Auth Elements
const navBrandLink = document.getElementById("nav-brand-link");
const portalRoleTag = document.getElementById("portal-role-tag");
const navLoggedOut = document.getElementById("nav-logged-out");
const navLoggedIn = document.getElementById("nav-logged-in");
const navUserName = document.getElementById("nav-user-name");
const navUserRole = document.getElementById("nav-user-role");
const btnHeaderLogin = document.getElementById("btn-header-login");
const btnHeaderLogout = document.getElementById("btn-header-logout");

// Landing Page CTAs
const btnLandingBrowse = document.getElementById("btn-landing-browse");
const btnLandingList = document.getElementById("btn-landing-list");
const btnRoleHostCta = document.getElementById("btn-role-host-cta");
const btnRoleSeekerCta = document.getElementById("btn-role-seeker-cta");

// Seeker Navigation
const btnSeekerBackHome = document.getElementById("btn-seeker-back-home");
const btnBackToMatches = document.getElementById("btn-back-to-matches");

// Auth Modal Elements
const authModal = document.getElementById("auth-modal");
const btnCloseModal = document.getElementById("btn-close-modal");
const tabAuthLogin = document.getElementById("tab-auth-login");
const tabAuthRegister = document.getElementById("tab-auth-register");
const formLogin = document.getElementById("form-login");
const formRegister = document.getElementById("form-register");
const btnSubmitLogin = document.getElementById("btn-submit-login");
const btnSubmitRegister = document.getElementById("btn-submit-register");
const modalErrorBox = document.getElementById("modal-error-box");
const modalErrorText = document.getElementById("modal-error-text");
const modalContextNotice = document.getElementById("modal-context-notice");
const modalContextMessage = document.getElementById("modal-context-message");
const regRoleSelect = document.getElementById("reg-role");
const regRoleHint = document.getElementById("reg-role-hint");

// Global Toast Banner
const globalAlert = document.getElementById("global-alert");
const alertMessage = document.getElementById("alert-message");
const alertIcon = document.getElementById("alert-icon");
const btnCloseAlert = document.getElementById("btn-close-alert");

// ====================================================================
// VIEW ROUTER & NAVIGATION
// ====================================================================

function showView(viewName) {
  viewLanding.classList.add("hidden");
  viewProvider.classList.add("hidden");
  viewSeeker.classList.add("hidden");

  if (viewName === "provider") {
    viewProvider.classList.remove("hidden");
    portalRoleTag.textContent = "Provider Portal";
    loadListings();
  } else if (viewName === "seeker") {
    viewSeeker.classList.remove("hidden");
    portalRoleTag.textContent = "Seeker Portal";
    showSeekerSubView("search");
  } else {
    viewLanding.classList.remove("hidden");
    portalRoleTag.textContent = "Hospitality Network";
  }
}

function showSeekerSubView(subView) {
  if (subView === "negotiate") {
    seekerSearchView.classList.add("hidden");
    seekerNegotiateView.classList.remove("hidden");
  } else {
    seekerSearchView.classList.remove("hidden");
    seekerNegotiateView.classList.add("hidden");
  }
}

function updateNavAuthState() {
  if (currentToken && currentUser) {
    navLoggedOut.classList.add("hidden");
    navLoggedIn.classList.remove("hidden");
    navUserName.textContent = currentUser.name || "Member";
    navUserRole.textContent = currentUser.role || "user";
  } else {
    navLoggedOut.classList.remove("hidden");
    navLoggedIn.classList.add("hidden");
  }
}

// Brand click handler
navBrandLink.addEventListener("click", () => {
  if (currentUser && currentUser.role === "provider") {
    showView("provider");
  } else if (currentUser && currentUser.role === "seeker") {
    showView("seeker");
  } else {
    showView("landing");
  }
});

// Landing Page CTAs
btnLandingBrowse.addEventListener("click", () => {
  showView("seeker");
});

btnRoleSeekerCta.addEventListener("click", () => {
  showView("seeker");
});

btnLandingList.addEventListener("click", () => {
  if (currentUser && currentUser.role === "provider") {
    showView("provider");
  } else {
    openAuthModal({
      lockedRole: "provider",
      contextMessage: "Register as a Hospitality Provider to list venues and equipment.",
      defaultTab: "register"
    });
  }
});

btnRoleHostCta.addEventListener("click", () => {
  if (currentUser && currentUser.role === "provider") {
    showView("provider");
  } else {
    openAuthModal({
      lockedRole: "provider",
      contextMessage: "Register as a Hospitality Provider to list venues and equipment.",
      defaultTab: "register"
    });
  }
});

btnSeekerBackHome.addEventListener("click", () => {
  showView("landing");
});

btnBackToMatches.addEventListener("click", () => {
  showSeekerSubView("search");
});

// Toast / Notification helper
function showAlert(message, type = "error") {
  const iconMap = { error: "❌", warning: "⚠️", success: "✓", info: "ℹ️" };
  globalAlert.className = `alert-banner alert-${type}`;
  alertMessage.textContent = message;
  if (alertIcon) alertIcon.textContent = iconMap[type] || "ℹ️";
  globalAlert.classList.remove("hidden");

  if (type === "success") {
    setTimeout(() => { globalAlert.classList.add("hidden"); }, 5000);
  }
}

function hideAlert() {
  globalAlert.classList.add("hidden");
}

btnCloseAlert.addEventListener("click", hideAlert);

// Button Loading State Helper
function setButtonLoading(button, isLoading, loadingText = "Processing...") {
  const spinner = button.querySelector(".btn-spinner");
  const label = button.querySelector(".btn-label");
  const icon = button.querySelector(".btn-icon");

  if (isLoading) {
    button.disabled = true;
    if (spinner) spinner.classList.remove("hidden");
    if (icon) icon.classList.add("hidden");
    if (label) {
      button.dataset.originalText = label.textContent;
      label.textContent = loadingText;
    }
  } else {
    button.disabled = false;
    if (spinner) spinner.classList.add("hidden");
    if (icon) icon.classList.remove("hidden");
    if (label && button.dataset.originalText) {
      label.textContent = button.dataset.originalText;
    }
  }
}

// Safe API Fetch Wrapper with Automatic Auth Header
async function apiFetch(endpoint, options = {}) {
  const root = getApiRoot();
  const url = `${root}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (currentToken) {
    headers["Authorization"] = `Bearer ${currentToken}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      let msg = `HTTP ${response.status}`;
      if (data) {
        msg = data.error || data.detail || (typeof data === "string" ? data : JSON.stringify(data));
      }
      const err = new Error(msg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError") || err.message.includes("Load failed"))) {
      throw new Error("Could not reach the server — check your connection or verify backend is running.");
    }
    throw err;
  }
}

// ====================================================================
// AUTHENTICATION MODAL & SESSION MANAGEMENT
// ====================================================================

function openAuthModal({ lockedRole = null, contextMessage = null, defaultTab = "login", onSuccess = null } = {}) {
  pendingAuthCallback = onSuccess;
  modalErrorBox.classList.add("hidden");

  if (contextMessage) {
    modalContextMessage.textContent = contextMessage;
    modalContextNotice.classList.remove("hidden");
  } else {
    modalContextNotice.classList.add("hidden");
  }

  if (lockedRole) {
    regRoleSelect.value = lockedRole;
    regRoleSelect.disabled = true;
    regRoleHint.textContent = `Role pre-set to ${lockedRole === "provider" ? "Host / Provider" : "Seeker / Planner"}.`;
  } else {
    regRoleSelect.disabled = false;
    regRoleHint.textContent = "Choose whether you plan to list spaces or book them.";
  }

  if (defaultTab === "register") {
    switchAuthTab("register");
  } else {
    switchAuthTab("login");
  }

  authModal.classList.remove("hidden");
}

function closeAuthModal() {
  authModal.classList.add("hidden");
  modalErrorBox.classList.add("hidden");
  formLogin.reset();
  formRegister.reset();
}

function switchAuthTab(tab) {
  modalErrorBox.classList.add("hidden");
  if (tab === "register") {
    tabAuthRegister.classList.add("active");
    tabAuthLogin.classList.remove("active");
    formRegister.classList.remove("hidden");
    formLogin.classList.add("hidden");
  } else {
    tabAuthLogin.classList.add("active");
    tabAuthRegister.classList.remove("active");
    formLogin.classList.remove("hidden");
    formRegister.classList.add("hidden");
  }
}

tabAuthLogin.addEventListener("click", () => switchAuthTab("login"));
tabAuthRegister.addEventListener("click", () => switchAuthTab("register"));
btnCloseModal.addEventListener("click", closeAuthModal);
btnHeaderLogin.addEventListener("click", () => openAuthModal());

// Logout Handler
btnHeaderLogout.addEventListener("click", () => {
  localStorage.removeItem("aether_token");
  localStorage.removeItem("aether_user");
  currentToken = null;
  currentUser = null;
  updateNavAuthState();
  showView("landing");
  showAlert("Logged out successfully.", "info");
});

// Login Form Submit
formLogin.addEventListener("submit", async (e) => {
  e.preventDefault();
  modalErrorBox.classList.add("hidden");

  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  if (!email || !password) {
    showModalError("Please enter email and password.");
    return;
  }

  setButtonLoading(btnSubmitLogin, true, "Signing in...");

  try {
    const data = await apiFetch("/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem("aether_token", currentToken);
    localStorage.setItem("aether_user", JSON.stringify(currentUser));

    updateNavAuthState();
    closeAuthModal();
    showAlert(`Welcome back, ${currentUser.name}!`, "success");

    // Execute pending action callback if present (e.g. continue negotiation)
    if (typeof pendingAuthCallback === "function") {
      const cb = pendingAuthCallback;
      pendingAuthCallback = null;
      cb();
    } else {
      // Immediate routing based on role
      if (currentUser.role === "provider") {
        showView("provider");
      } else {
        showView("seeker");
      }
    }
  } catch (err) {
    showModalError(err.message || "Invalid email or password");
  } finally {
    setButtonLoading(btnSubmitLogin, false);
  }
});

// Register Form Submit
formRegister.addEventListener("submit", async (e) => {
  e.preventDefault();
  modalErrorBox.classList.add("hidden");

  const name = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const role = regRoleSelect.value;

  if (!name || !email || !password) {
    showModalError("Please fill in all fields.");
    return;
  }

  setButtonLoading(btnSubmitRegister, true, "Creating Account...");

  try {
    const data = await apiFetch("/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password, role })
    });

    currentToken = data.token;
    currentUser = data.user;
    localStorage.setItem("aether_token", currentToken);
    localStorage.setItem("aether_user", JSON.stringify(currentUser));

    updateNavAuthState();
    closeAuthModal();
    showAlert(`Welcome to AetherPact, ${currentUser.name}!`, "success");

    if (typeof pendingAuthCallback === "function") {
      const cb = pendingAuthCallback;
      pendingAuthCallback = null;
      cb();
    } else {
      if (currentUser.role === "provider") {
        showView("provider");
      } else {
        showView("seeker");
      }
    }
  } catch (err) {
    showModalError(err.message || "Registration failed");
  } finally {
    setButtonLoading(btnSubmitRegister, false);
  }
});

function showModalError(msg) {
  modalErrorText.textContent = msg;
  modalErrorBox.classList.remove("hidden");
}

// Session restore on page load
async function restoreSession() {
  if (!currentToken) {
    showView("landing");
    updateNavAuthState();
    return;
  }

  try {
    const user = await apiFetch("/me");
    if (user && user.id) {
      currentUser = user;
      localStorage.setItem("aether_user", JSON.stringify(currentUser));
      updateNavAuthState();

      if (currentUser.role === "provider") {
        showView("provider");
      } else {
        showView("seeker");
      }
    } else {
      throw new Error("Invalid session");
    }
  } catch (err) {
    console.warn("Session restore failed, returning to landing page:", err);
    localStorage.removeItem("aether_token");
    localStorage.removeItem("aether_user");
    currentToken = null;
    currentUser = null;
    updateNavAuthState();
    showView("landing");
  }
}

// ====================================================================
// GOOGLE MAPS & LOCATION PARSING UTILITIES
// ====================================================================

function extractCoordsFromGoogleMaps(text) {
  if (!text) return null;
  const str = String(text).trim();

  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  const qMatch = str.match(/[?&](?:q|ll|destination)=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };

  const rawMatch = str.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (rawMatch) return { lat: parseFloat(rawMatch[1]), lng: parseFloat(rawMatch[2]) };

  return null;
}

const MUMBAI_HUBS = {
  bkc: { name: "Bandra Kurla Complex (BKC), Mumbai", lat: 19.0680, lng: 72.8680 },
  bandra: { name: "Bandra West, Mumbai", lat: 19.0550, lng: 72.8250 },
  andheri: { name: "Andheri East Industrial Area, Mumbai", lat: 19.1150, lng: 72.8680 },
  marine_drive: { name: "Marine Drive, Mumbai", lat: 18.9430, lng: 72.8230 },
  juhu: { name: "Juhu Beach, Mumbai", lat: 19.0980, lng: 72.8260 },
  lower_parel: { name: "Lower Parel Media Hub, Mumbai", lat: 19.0010, lng: 72.8290 }
};

function resolveLocationText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const key of Object.keys(MUMBAI_HUBS)) {
    if (lower.includes(key) || lower.includes(key.replace("_", " "))) {
      return MUMBAI_HUBS[key];
    }
  }
  return null;
}

// ====================================================================
// PROVIDER PORTAL (List a Resource & Community Directory)
// ====================================================================
const listingForm = document.getElementById("listing-form");
const btnSubmitListing = document.getElementById("btn-submit-listing");
const btnRefreshListings = document.getElementById("btn-refresh-listings");
const listingsContainer = document.getElementById("listings-container");
const listingsLoadingState = document.getElementById("listings-loading-state");
const listingsEmptyState = document.getElementById("listings-empty-state");
const listingSuccessBox = document.getElementById("listing-success-box");
const listingSuccessDetails = document.getElementById("listing-success-details");

const listingMapsInput = document.getElementById("listing-maps-url");
const listingLocStatus = document.getElementById("listing-loc-status");
const listingLocText = document.getElementById("listing-loc-text");
const listingMapPreviewLink = document.getElementById("listing-map-preview-link");
const listingLatHidden = document.getElementById("listing-lat");
const listingLngHidden = document.getElementById("listing-lng");
const listingLocNameHidden = document.getElementById("listing-loc-name");
const providerLocChips = document.querySelectorAll(".loc-chip");

function updateListingLocation(name, lat, lng, rawUrl = null) {
  listingLatHidden.value = lat;
  listingLngHidden.value = lng;
  listingLocNameHidden.value = name;

  const mapsUrl = rawUrl && rawUrl.startsWith("http") 
    ? rawUrl 
    : `https://www.google.com/maps?q=${lat},${lng}`;

  listingLocText.textContent = `Location set to ${name}`;
  listingMapPreviewLink.href = mapsUrl;
  listingMapPreviewLink.classList.remove("hidden");
  listingLocStatus.classList.remove("hidden");
}

listingMapsInput.addEventListener("input", () => {
  const val = listingMapsInput.value.trim();
  if (!val) return;

  const coords = extractCoordsFromGoogleMaps(val);
  if (coords) {
    updateListingLocation("Google Maps Location", coords.lat, coords.lng, val);
    showAlert("Google Maps location detected and verified!", "success");
    providerLocChips.forEach(c => c.classList.remove("active"));
  } else {
    const resolved = resolveLocationText(val);
    if (resolved) {
      updateListingLocation(resolved.name, resolved.lat, resolved.lng);
    }
  }
});

providerLocChips.forEach(chip => {
  chip.addEventListener("click", () => {
    providerLocChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");

    const name = chip.dataset.name;
    const lat = parseFloat(chip.dataset.lat);
    const lng = parseFloat(chip.dataset.lng);

    listingMapsInput.value = `https://www.google.com/maps?q=${lat},${lng}`;
    updateListingLocation(name, lat, lng);
  });
});

function formatResourceType(typeStr) {
  const map = {
    banquet_hall: "Banquet Hall",
    kitchen: "Commercial Kitchen",
    av_equipment: "AV & Staging",
    vehicle: "Executive Shuttle",
    other: "Hospitality Asset"
  };
  return map[typeStr] || typeStr.replace(/_/g, " ");
}

function renderListings(items) {
  listingsContainer.innerHTML = "";

  if (!items || items.length === 0) {
    listingsEmptyState.classList.remove("hidden");
    return;
  }

  listingsEmptyState.classList.add("hidden");

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "listing-card";

    const badgeClass = `badge-${item.resource_type || "other"}`;
    const priceFormatted = Number(item.price).toLocaleString("en-IN");
    const mapsLink = item.google_maps_url || `https://www.google.com/maps?q=${item.lat},${item.lng}`;
    const locationName = item.location_name || "Mumbai, India";

    card.innerHTML = `
      <div class="listing-card-top">
        <h4 class="listing-card-title">${escapeHtml(item.title)}</h4>
        <span class="listing-badge ${badgeClass}">${escapeHtml(formatResourceType(item.resource_type))}</span>
      </div>
      <div class="listing-location-tag">
        <span>📍</span>
        <span>${escapeHtml(locationName)}</span>
      </div>
      <p class="listing-desc">${escapeHtml(item.description)}</p>
      <div class="listing-footer-row">
        <div>
          <span class="listing-rate">₹${priceFormatted} <small>/ day</small></span>
          <span style="font-size: 0.8rem; color: #64748B; margin-left: 8px;">Capacity: <strong>${item.capacity}</strong></span>
        </div>
        <a href="${mapsLink}" target="_blank" rel="noopener" class="btn-map-redirect" title="Open in Google Maps">
          <span>📍 View on Google Maps ↗</span>
        </a>
      </div>
    `;

    listingsContainer.appendChild(card);
  });
}

async function loadListings() {
  listingsLoadingState.classList.remove("hidden");
  listingsEmptyState.classList.add("hidden");

  try {
    const data = await apiFetch("/listings");
    renderListings(data);
  } catch (err) {
    showAlert(err.message || "Failed to load listings.", "error");
  } finally {
    listingsLoadingState.classList.add("hidden");
  }
}

btnRefreshListings.addEventListener("click", loadListings);

// Submit new listing (Protected)
listingForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();
  listingSuccessBox.classList.add("hidden");

  if (!currentUser || currentUser.role !== "provider") {
    openAuthModal({
      lockedRole: "provider",
      contextMessage: "Please log in as a provider to list a resource."
    });
    return;
  }

  const title = document.getElementById("listing-title").value.trim();
  const description = document.getElementById("listing-desc").value.trim();
  const resource_type = document.getElementById("listing-type").value;
  const price = parseFloat(document.getElementById("listing-price").value);
  const capacity = parseInt(document.getElementById("listing-capacity").value, 10);
  const lat = parseFloat(listingLatHidden.value);
  const lng = parseFloat(listingLngHidden.value);
  const location_name = listingLocNameHidden.value || "Mumbai, India";
  const google_maps_url = listingMapsInput.value.trim() || `https://www.google.com/maps?q=${lat},${lng}`;

  if (!title || !description || isNaN(price) || isNaN(capacity) || isNaN(lat) || isNaN(lng)) {
    showAlert("Please complete all required fields.", "warning");
    return;
  }

  setButtonLoading(btnSubmitListing, true, "Publishing Listing...");

  try {
    const payload = {
      title,
      description,
      resource_type,
      price,
      capacity,
      lat,
      lng,
      location_name,
      google_maps_url
    };

    const created = await apiFetch("/listings", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    listingSuccessBox.classList.remove("hidden");
    listingSuccessDetails.innerHTML = `
      <p><strong>${escapeHtml(created.title)}</strong> has been published to the community!</p>
      <p>Location: ${escapeHtml(created.location_name)} &bull; Day Rate: ₹${Number(created.price).toLocaleString("en-IN")}</p>
      <p style="margin-top: 6px;"><a href="${created.google_maps_url}" target="_blank" rel="noopener" style="color: #047857; font-weight: 700;">View on Google Maps ↗</a></p>
    `;

    listingForm.reset();
    updateListingLocation("Bandra Kurla Complex (BKC), Mumbai", 19.0680, 72.8680);
    await loadListings();
  } catch (err) {
    showAlert(err.message || "Failed to publish listing.", "error");
  } finally {
    setButtonLoading(btnSubmitListing, false);
  }
});

// ====================================================================
// SEEKER PORTAL (Search & Negotiate Subviews)
// ====================================================================
const matchForm = document.getElementById("match-form");
const btnSubmitMatch = document.getElementById("btn-submit-match");
const btnSampleSearch = document.getElementById("btn-sample-search");
const matchLocationInput = document.getElementById("match-location");
const btnUseGps = document.getElementById("btn-use-gps");
const matchLatHidden = document.getElementById("match-lat");
const matchLngHidden = document.getElementById("match-lng");
const seekerLocText = document.getElementById("seeker-loc-text");
const seekerLocChips = document.querySelectorAll(".loc-chip-seeker");

const matchResultsContainer = document.getElementById("match-results-container");
const matchLoadingState = document.getElementById("match-loading-state");
const matchInitialState = document.getElementById("match-initial-state");
const matchEmptyState = document.getElementById("match-empty-state");
const resultsCountBadge = document.getElementById("results-count-badge");

function updateSeekerLocation(name, lat, lng) {
  matchLatHidden.value = lat;
  matchLngHidden.value = lng;
  seekerLocText.textContent = `Location set to ${name}`;
}

matchLocationInput.addEventListener("input", () => {
  const val = matchLocationInput.value.trim();
  if (!val) return;

  const coords = extractCoordsFromGoogleMaps(val);
  if (coords) {
    updateSeekerLocation("Google Maps Pin", coords.lat, coords.lng);
    showAlert("Location parsed from Google Maps!", "success");
    seekerLocChips.forEach(c => c.classList.remove("active"));
  } else {
    const resolved = resolveLocationText(val);
    if (resolved) {
      updateSeekerLocation(resolved.name, resolved.lat, resolved.lng);
    }
  }
});

seekerLocChips.forEach(chip => {
  chip.addEventListener("click", () => {
    seekerLocChips.forEach(c => c.classList.remove("active"));
    chip.classList.add("active");

    const name = chip.dataset.name;
    const lat = parseFloat(chip.dataset.lat);
    const lng = parseFloat(chip.dataset.lng);

    matchLocationInput.value = name;
    updateSeekerLocation(name, lat, lng);
  });
});

btnUseGps.addEventListener("click", () => {
  if (!navigator.geolocation) {
    showAlert("Geolocation is not supported by your browser.", "warning");
    return;
  }

  btnUseGps.textContent = "📍 Locating...";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      matchLocationInput.value = `https://www.google.com/maps?q=${lat.toFixed(4)},${lng.toFixed(4)}`;
      updateSeekerLocation(`Your GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng);
      btnUseGps.textContent = "📍 Use My Current Location";
      showAlert("GPS coordinates acquired!", "success");
    },
    () => {
      btnUseGps.textContent = "📍 Use My Current Location";
      showAlert("Could not access location. Please select an area above.", "warning");
    }
  );
});

btnSampleSearch.addEventListener("click", () => {
  document.getElementById("match-desc").value = "need a luxury banquet hall for 200 wedding guests with stage, soundproofing, and central AC";
  document.getElementById("match-budget").value = "20000";
  document.getElementById("match-type").value = "banquet_hall";
  matchLocationInput.value = "Bandra Kurla Complex (BKC), Mumbai";
  updateSeekerLocation("Bandra Kurla Complex (BKC), Mumbai", 19.0680, 72.8680);
  showAlert("Sample search loaded! Click 'Find Matching Resources'.", "info");
});

function renderMatches(matches) {
  matchResultsContainer.innerHTML = "";
  matchInitialState.classList.add("hidden");

  if (!matches || matches.length === 0) {
    matchEmptyState.classList.remove("hidden");
    resultsCountBadge.textContent = "0 matches found";
    return;
  }

  matchEmptyState.classList.add("hidden");
  resultsCountBadge.textContent = `${matches.length} Top Matches`;

  matches.forEach((item, index) => {
    const listing = item.listing;
    const finalPercent = Math.round(item.final_score * 100);
    const bd = item.breakdown;

    const semanticPct = Math.round(bd.semantic * 100);
    const pricePct = Math.round(bd.price_fit * 100);
    const distPct = Math.round(bd.distance * 100);

    const card = document.createElement("div");
    card.className = "match-card";

    const badgeClass = `badge-${listing.resource_type || "other"}`;
    const mapsUrl = listing.google_maps_url || `https://www.google.com/maps?q=${listing.lat},${listing.lng}`;
    const locationName = listing.location_name || "Mumbai, India";

    card.innerHTML = `
      <div class="match-card-top">
        <div class="match-rank-title">
          <span class="match-rank-badge">#${index + 1}</span>
          <h4 class="match-title">${escapeHtml(listing.title)}</h4>
          <span class="listing-badge ${badgeClass}">${escapeHtml(formatResourceType(listing.resource_type))}</span>
        </div>
        <div class="match-score-badge">
          <div class="match-pct">${finalPercent}%</div>
          <span class="match-pct-label">Match Score</span>
        </div>
      </div>

      <div class="match-location-bar">
        <div class="match-loc-info">
          <span>📍</span>
          <span>${escapeHtml(locationName)}</span>
          <span class="match-distance-tag">(${bd.distance_km.toFixed(1)} km away)</span>
        </div>
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-map-redirect" title="Open in Google Maps">
          <span>📍 View on Google Maps ↗</span>
        </a>
      </div>

      <p class="match-desc">${escapeHtml(listing.description)}</p>

      <div class="breakdown-box">
        <div class="meter-row">
          <span class="meter-label">Requirement Fit (50%)</span>
          <div class="meter-track">
            <div class="meter-bar meter-semantic" style="width: ${semanticPct}%;"></div>
          </div>
          <span class="meter-val">${bd.semantic.toFixed(3)}</span>
        </div>

        <div class="meter-row">
          <span class="meter-label">Budget Fit (30%)</span>
          <div class="meter-track">
            <div class="meter-bar meter-price" style="width: ${pricePct}%;"></div>
          </div>
          <span class="meter-val">${bd.price_fit.toFixed(3)}</span>
        </div>

        <div class="meter-row">
          <span class="meter-label">Proximity Fit (20%)</span>
          <div class="meter-track">
            <div class="meter-bar meter-distance" style="width: ${distPct}%;"></div>
          </div>
          <span class="meter-val">${bd.distance.toFixed(3)}</span>
        </div>
      </div>

      <div class="match-card-actions">
        <div>
          <span class="match-price-display">₹${Number(listing.price).toLocaleString("en-IN")} <small style="font-size:0.75rem; color:#64748B;">/ day</small></span>
          <span style="font-size: 0.8rem; color: #64748B; margin-left: 8px;">Capacity: ${listing.capacity}</span>
        </div>
        <button type="button" class="btn btn-primary btn-sm btn-negotiate-cta">
          Negotiate with Host &rarr;
        </button>
      </div>
    `;

    // Hook Negotiate CTA (Protected: Gated if unauthenticated)
    const btnNego = card.querySelector(".btn-negotiate-cta");
    btnNego.addEventListener("click", () => {
      handleNegotiateClick(listing);
    });

    matchResultsContainer.appendChild(card);
  });
}

function handleNegotiateClick(listing) {
  if (currentToken && currentUser) {
    // Already authenticated: proceed straight to negotiation view
    openNegotiationWithListing(listing);
  } else {
    // Unauthenticated: gate action with Auth Modal pre-set to "seeker"
    openAuthModal({
      lockedRole: "seeker",
      contextMessage: "Log in or create a free account to continue with this rental request.",
      defaultTab: "register",
      onSuccess: () => {
        // Automatically continue into Negotiate view for this exact listing!
        openNegotiationWithListing(listing);
      }
    });
  }
}

// Public Match Form Submission
matchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  const description = document.getElementById("match-desc").value.trim();
  const budget = parseFloat(document.getElementById("match-budget").value);
  const lat = parseFloat(matchLatHidden.value);
  const lng = parseFloat(matchLngHidden.value);
  const resource_type = document.getElementById("match-type").value;
  const location_name = matchLocationInput.value.trim();

  if (!description || isNaN(budget)) {
    showAlert("Please specify your resource requirement and budget.", "warning");
    return;
  }

  setButtonLoading(btnSubmitMatch, true, "Finding Matches...");
  matchLoadingState.classList.remove("hidden");
  matchResultsContainer.innerHTML = "";
  matchInitialState.classList.add("hidden");
  matchEmptyState.classList.add("hidden");

  try {
    const payload = {
      description,
      budget,
      lat: isNaN(lat) ? 19.0760 : lat,
      lng: isNaN(lng) ? 72.8777 : lng,
      location_name: location_name || "Mumbai, India",
      resource_type: resource_type || null
    };

    const data = await apiFetch("/match", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    renderMatches(data.matches || []);
  } catch (err) {
    showAlert(err.message || "Match search failed.", "error");
    matchInitialState.classList.remove("hidden");
  } finally {
    setButtonLoading(btnSubmitMatch, false);
    matchLoadingState.classList.add("hidden");
  }
});

// Pre-fill Negotiate Subview from listing
function openNegotiationWithListing(listing) {
  const providerAsk = listing.price;
  const providerMin = Math.round(providerAsk * 0.85);

  const seekerBudgetInput = parseFloat(document.getElementById("match-budget").value);
  const seekerMax = !isNaN(seekerBudgetInput) && seekerBudgetInput > 0 
    ? seekerBudgetInput 
    : providerAsk;
  const seekerOffer = Math.min(Math.round(providerAsk * 0.9), Math.round(seekerMax * 0.9));

  document.getElementById("nego-provider-min").value = providerMin;
  document.getElementById("nego-provider-ask").value = providerAsk;
  document.getElementById("nego-seeker-offer").value = seekerOffer;
  document.getElementById("nego-seeker-max").value = seekerMax;
  document.getElementById("nego-extra-terms").value = `Listing #${listing.id}: ${listing.title}`;

  document.getElementById("nego-settled-box").classList.add("hidden");
  document.getElementById("nego-nodeal-box").classList.add("hidden");
  document.getElementById("nego-initial-state").classList.remove("hidden");

  showView("seeker");
  showSeekerSubView("negotiate");
  showAlert(`Loaded terms for "${listing.title}" into Automated Settlement Engine.`, "success");
}

// Negotiate Form Submission (Protected: Token required)
const negotiateForm = document.getElementById("negotiate-form");
const btnSubmitNegotiate = document.getElementById("btn-submit-negotiate");
const negoLoadingState = document.getElementById("nego-loading-state");
const negoInitialState = document.getElementById("nego-initial-state");
const negoSettledBox = document.getElementById("nego-settled-box");
const settledClearingPrice = document.getElementById("settled-clearing-price");
const settledSummaryText = document.getElementById("settled-summary-text");
const negoNoDealBox = document.getElementById("nego-nodeal-box");
const noDealMessageText = document.getElementById("nodeal-message-text");

negotiateForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideAlert();

  if (!currentToken) {
    openAuthModal({
      lockedRole: "seeker",
      contextMessage: "Please log in or register to continue with this rental request."
    });
    return;
  }

  const provider_min = parseFloat(document.getElementById("nego-provider-min").value);
  const provider_ask = parseFloat(document.getElementById("nego-provider-ask").value);
  const seeker_offer = parseFloat(document.getElementById("nego-seeker-offer").value);
  const seeker_max = parseFloat(document.getElementById("nego-seeker-max").value);
  const extra_terms = document.getElementById("nego-extra-terms").value.trim();

  if (isNaN(provider_min) || isNaN(provider_ask) || isNaN(seeker_offer) || isNaN(seeker_max)) {
    showAlert("Please enter all four pricing boundary numbers.", "warning");
    return;
  }

  setButtonLoading(btnSubmitNegotiate, true, "Calculating Fair Settlement Price...");
  negoLoadingState.classList.remove("hidden");
  negoInitialState.classList.add("hidden");
  negoSettledBox.classList.add("hidden");
  negoNoDealBox.classList.add("hidden");

  try {
    const payload = {
      provider_min,
      provider_ask,
      seeker_offer,
      seeker_max,
      extra_terms: extra_terms || null
    };

    const result = await apiFetch("/negotiate", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    if (result.status === "settled") {
      settledClearingPrice.textContent = `₹${Number(result.clearing_price).toLocaleString("en-IN")}`;
      settledSummaryText.textContent = result.summary;
      negoSettledBox.classList.remove("hidden");
    } else if (result.status === "no_deal") {
      noDealMessageText.textContent = result.message;
      negoNoDealBox.classList.remove("hidden");
    } else {
      throw new Error("Unexpected response from settlement engine.");
    }
  } catch (err) {
    showAlert(err.message || "Settlement calculation failed.", "error");
    negoInitialState.classList.remove("hidden");
  } finally {
    setButtonLoading(btnSubmitNegotiate, false);
    negoLoadingState.classList.add("hidden");
  }
});

function escapeHtml(text) {
  if (!text) return "";
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Initial Boot Sequence
window.addEventListener("DOMContentLoaded", async () => {
  updateListingLocation("Bandra Kurla Complex (BKC), Mumbai", 19.0680, 72.8680);
  updateSeekerLocation("Bandra Kurla Complex (BKC), Mumbai", 19.0680, 72.8680);
  await restoreSession();
});
