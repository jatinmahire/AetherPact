const API_BASE = "PASTE_YOUR_RENDER_BACKEND_URL_HERE";

/**
 * Validates backend API URLs to prevent fetch crashes caused by placeholder
 * angle brackets (e.g. <your-render-app-name>) or unparseable protocol strings.
 */
function isValidBackendUrl(url) {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (
    trimmed.includes("<") ||
    trimmed.includes(">") ||
    trimmed.includes("PASTE_YOUR_RENDER_BACKEND_URL_HERE") ||
    trimmed.includes("your-render-app-name")
  ) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

/**
 * Resolves active backend API root dynamically.
 * Priority:
 * 1. window.AETHER_API_URL override (if valid)
 * 2. URL parameter: ?api=https://... (if valid, stored in localStorage)
 * 3. Persistent localStorage: 'aether_api_url' (auto-purged if corrupt/placeholder)
 * 4. API_BASE constant (if configured and valid)
 * 5. Fallback: http://127.0.0.1:8000 for local development
 */
function getApiRoot() {
  if (window.AETHER_API_URL && isValidBackendUrl(window.AETHER_API_URL)) {
    return window.AETHER_API_URL.trim().replace(/\/+$/, "");
  }

  try {
    const urlParams = new URLSearchParams(window.location.search);
    const queryApi = urlParams.get("api");
    if (queryApi) {
      if (isValidBackendUrl(queryApi)) {
        const clean = queryApi.trim().replace(/\/+$/, "");
        localStorage.setItem("aether_api_url", clean);
        return clean;
      } else {
        console.warn("[API] Ignored invalid URL parameter ?api=", queryApi);
      }
    }
  } catch (_) {}

  try {
    const stored = localStorage.getItem("aether_api_url");
    if (stored) {
      if (isValidBackendUrl(stored)) {
        return stored.trim().replace(/\/+$/, "");
      } else {
        // Automatically purge corrupt or placeholder URLs (<your-render-app-name>)
        console.warn("[API] Automatically purged invalid stored backend URL:", stored);
        localStorage.removeItem("aether_api_url");
      }
    }
  } catch (_) {}

  if (isValidBackendUrl(API_BASE)) {
    return API_BASE.trim().replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
}

// Global helper to set Render backend URL at runtime from console or UI
window.setBackendUrl = function(url) {
  if (!url || typeof url !== "string") {
    alert("Please provide a valid backend URL, e.g. setBackendUrl('https://your-service.onrender.com')");
    return;
  }
  // Sanitize: strip any accidental angle brackets and trailing slashes
  const clean = url.trim().replace(/[<>]/g, "").replace(/\/+$/, "");
  if (!isValidBackendUrl(clean)) {
    alert("Invalid URL format! Make sure it starts with https:// or http:// and does not contain brackets.\nExample: https://aetherpact-backend.onrender.com");
    return;
  }
  localStorage.setItem("aether_api_url", clean);
  console.log(`[API] Backend URL updated to: ${clean}`);
  alert(`Backend URL updated to:\n${clean}\n\nReloading page to connect...`);
  window.location.reload();
};

// Global helper to reset backend URL to localhost
window.resetBackendUrl = function() {
  localStorage.removeItem("aether_api_url");
  console.log("[API] Backend URL reset to local default (http://127.0.0.1:8000)");
  alert("Backend URL reset to local default:\nhttp://127.0.0.1:8000\n\nReloading page...");
  window.location.reload();
};



// Global Reusable AI Sparkle Icon SVG
const AI_SPARKLE_SVG = `<svg class="ai-sparkle-icon" viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"/></svg>`;

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

// Header Search Shortcut Button
const btnHeaderSearch = document.getElementById("btn-header-search");
if (btnHeaderSearch) {
  btnHeaderSearch.addEventListener("click", () => {
    showView("seeker");
  });
}

// Smooth scrolling for header nav links
document.querySelectorAll(".header-nav-links .nav-link").forEach(link => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    const targetId = link.getAttribute("href").replace("#", "");
    showView("landing");
    setTimeout(() => {
      const targetEl = document.getElementById(targetId);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  });
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

// Quick Category Pills on Landing Hero
document.querySelectorAll(".quick-cat-pill").forEach(pill => {
  pill.addEventListener("click", () => {
    const cat = pill.dataset.category;
    showView("seeker");
    const matchTypeSelect = document.getElementById("match-type");
    if (matchTypeSelect) {
      matchTypeSelect.value = cat;
    }
    showAlert(`Selected category: ${pill.textContent.trim()}. Enter your requirements and budget!`, "info");
  });
});

btnSeekerBackHome.addEventListener("click", () => {
  showView("landing");
});

btnBackToMatches.addEventListener("click", () => {
  showSeekerSubView("search");
});

// Toast / Notification helper
function showAlert(message, type = "error") {
  const iconMap = {
    error: `<svg class="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`,
    warning: `<svg class="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    success: `<svg class="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    info: `<svg class="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
  };
  globalAlert.className = `alert-banner alert-${type}`;
  alertMessage.textContent = message;
  if (alertIcon) alertIcon.innerHTML = iconMap[type] || iconMap.info;
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
    if (err.message && err.message.includes("Failed to parse URL")) {
      throw new Error(`Invalid Backend URL "${root}". Please remove any "<" or ">" brackets from your Render URL.`);
    }
    if (err.message && (err.message.includes("Failed to fetch") || err.message.includes("NetworkError") || err.message.includes("Load failed"))) {
      if (root.includes("onrender.com")) {
        throw new Error(
          `Could not reach Render backend (${root}). Free Render instances sleep after 15 minutes of inactivity and take ~45-60s to wake up (cold start). Please wait 30 seconds and try again, or click the API Status pill in the header.`
        );
      } else {
        throw new Error(`Could not reach backend at ${root}. Please ensure your local Python backend is running on port 8000.`);
      }
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
  modalErrorText.innerHTML = msg;
  if (
    msg.includes("URL") ||
    msg.includes("brackets") ||
    msg.includes("backend") ||
    msg.includes("Render") ||
    msg.includes("reach") ||
    msg.includes("connection")
  ) {
    const actionWrap = document.createElement("div");
    actionWrap.style.cssText = "margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;";
    actionWrap.innerHTML = `
      <button type="button" class="btn btn-sm btn-outline" onclick="window.resetBackendUrl()" style="padding: 3px 9px; font-size: 0.78rem;">
        Reset to Localhost (127.0.0.1:8000)
      </button>
      <button type="button" class="btn btn-sm btn-outline" onclick="window.openServerConfigModal()" style="padding: 3px 9px; font-size: 0.78rem;">
        Configure Backend URL
      </button>
    `;
    modalErrorText.appendChild(actionWrap);
  }
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
        <svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
        <span>${escapeHtml(locationName)}</span>
      </div>
      <p class="listing-desc">${escapeHtml(item.description)}</p>
      <div class="listing-footer-row">
        <div>
          <span class="listing-rate">₹${priceFormatted} <small>/ day</small></span>
          <span style="font-size: 0.8rem; color: #64748B; margin-left: 8px;">Capacity: <strong>${item.capacity}</strong></span>
        </div>
        <a href="${mapsLink}" target="_blank" rel="noopener" class="btn-map-redirect" title="Open in Google Maps">
          <svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>View on Google Maps ↗</span>
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
const matchLoadingStepText = document.getElementById("match-loading-step-text");
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

  btnUseGps.innerHTML = '<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Locating...';
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      matchLocationInput.value = `https://www.google.com/maps?q=${lat.toFixed(4)},${lng.toFixed(4)}`;
      updateSeekerLocation(`Your GPS Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`, lat, lng);
      btnUseGps.innerHTML = '<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg> Use My Current Location';
      showAlert("GPS coordinates acquired!", "success");
    },
    () => {
      btnUseGps.innerHTML = '<svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="22" y1="12" x2="18" y2="12"></line><line x1="6" y1="12" x2="2" y2="12"></line><line x1="12" y1="6" x2="12" y2="2"></line><line x1="12" y1="22" x2="12" y2="18"></line></svg> Use My Current Location';
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

    // Confidence badge mapping
    let confBadgeHtml = "";
    if (item.confidence_label) {
      let confColorClass = "badge-weak-match";
      if (item.confidence_label === "Strong Match") confColorClass = "badge-strong-match";
      else if (item.confidence_label === "Good Match") confColorClass = "badge-good-match";
      else if (item.confidence_label === "Partial Match") confColorClass = "badge-partial-match";
      else if (item.confidence_label === "Weak Match") confColorClass = "badge-weak-match";

      confBadgeHtml = `<span class="badge-confidence ${confColorClass}" title="Deterministic confidence: ${item.confidence_label}">${AI_SPARKLE_SVG} ${escapeHtml(item.confidence_label)}</span>`;
    }

    // Expandable "Why this match?" section (gracefully hidden if missing or empty)
    let insightAccordionHtml = "";
    if (item.insight && item.insight.trim()) {
      insightAccordionHtml = `
        <div class="match-insight-accordion">
          <button type="button" class="match-insight-toggle" aria-expanded="false" title="Click to view AI reasoning breakdown">
            <span class="insight-toggle-left">
              <span class="insight-toggle-icon">${AI_SPARKLE_SVG}</span>
              <span>Why this match?</span>
            </span>
            <span class="insight-toggle-arrow"><svg class="ui-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg></span>
          </button>
          <div class="match-insight-content">
            <p class="match-insight-text">${escapeHtml(item.insight)}</p>
          </div>
        </div>
      `;
    }

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
          ${confBadgeHtml}
        </div>
      </div>

      <div class="match-location-bar">
        <div class="match-loc-info">
          <svg class="ui-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>${escapeHtml(locationName)}</span>
          <span class="match-distance-tag">(${bd.distance_km.toFixed(1)} km away)</span>
        </div>
        <a href="${mapsUrl}" target="_blank" rel="noopener" class="btn-map-redirect" title="Open in Google Maps">
          <svg class="ui-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
          <span>View on Google Maps ↗</span>
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

      ${insightAccordionHtml}

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

    // Hook Accordion Toggle
    const insightToggle = card.querySelector(".match-insight-toggle");
    if (insightToggle) {
      insightToggle.addEventListener("click", () => {
        const accordion = card.querySelector(".match-insight-accordion");
        const isExpanded = accordion.classList.toggle("expanded");
        insightToggle.setAttribute("aria-expanded", String(isExpanded));
      });
    }

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

  // Sequential processing labels tied to genuine request stages
  const matchStages = [
    "Comparing descriptions with semantic TF-IDF...",
    "Checking budget fit...",
    "Calculating geospatial distance..."
  ];
  let currentStageIdx = 0;
  if (matchLoadingStepText) {
    matchLoadingStepText.textContent = matchStages[0];
  }
  const pacingInterval = setInterval(() => {
    currentStageIdx = (currentStageIdx + 1) % matchStages.length;
    if (matchLoadingStepText) {
      matchLoadingStepText.textContent = matchStages[currentStageIdx];
    }
  }, 250);

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
    // End pacing immediately upon response arrival — never outlasts actual network response
    clearInterval(pacingInterval);
    setButtonLoading(btnSubmitMatch, false);
    matchLoadingState.classList.add("hidden");
    if (matchLoadingStepText) {
      matchLoadingStepText.textContent = "Evaluating semantic vectors, price fit, and distances...";
    }
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
  if (settledNegotiationInsightBox) {
    settledNegotiationInsightBox.classList.add("hidden");
    if (settledNegotiationInsightText) settledNegotiationInsightText.textContent = "";
  }

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
const settledNegotiationInsightBox = document.getElementById("settled-negotiation-insight-box");
const settledNegotiationInsightText = document.getElementById("settled-negotiation-insight-text");
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
  if (settledNegotiationInsightBox) {
    settledNegotiationInsightBox.classList.add("hidden");
    if (settledNegotiationInsightText) settledNegotiationInsightText.textContent = "";
  }

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

      // Real negotiation insight display (gracefully hide if absent)
      if (settledNegotiationInsightBox && settledNegotiationInsightText) {
        if (result.negotiation_insight && result.negotiation_insight.trim()) {
          settledNegotiationInsightText.textContent = result.negotiation_insight.trim();
          settledNegotiationInsightBox.classList.remove("hidden");
        } else {
          settledNegotiationInsightText.textContent = "";
          settledNegotiationInsightBox.classList.add("hidden");
        }
      }

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

// ====================================================================
// AI SEARCH ASSISTANT (Landing Page Floating & Embedded Chat Widget)
// ====================================================================
const aiChatWidget = document.getElementById("ai-chat-widget");
const btnChatToggle = document.getElementById("btn-chat-toggle");
const aiChatPanel = document.getElementById("ai-chat-panel");
const btnChatClose = document.getElementById("btn-chat-close");
const btnHeroChatTrigger = document.getElementById("btn-hero-chat-trigger");
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const btnChatSend = document.getElementById("btn-chat-send");
const chatSuggestChips = document.querySelectorAll(".chat-suggest-chip");

let isChatOpen = false;

function setChatOpen(open) {
  isChatOpen = open;
  if (isChatOpen) {
    aiChatPanel.classList.remove("hidden");
    const sparkleIcon = btnChatToggle ? btnChatToggle.querySelector(".chat-icon-sparkle") : null;
    const closeIcon = btnChatToggle ? btnChatToggle.querySelector(".chat-icon-close") : null;
    if (sparkleIcon) sparkleIcon.classList.add("hidden");
    if (closeIcon) closeIcon.classList.remove("hidden");
    setTimeout(() => {
      if (chatInput) chatInput.focus();
    }, 120);
  } else {
    aiChatPanel.classList.add("hidden");
    const sparkleIcon = btnChatToggle ? btnChatToggle.querySelector(".chat-icon-sparkle") : null;
    const closeIcon = btnChatToggle ? btnChatToggle.querySelector(".chat-icon-close") : null;
    if (sparkleIcon) sparkleIcon.classList.remove("hidden");
    if (closeIcon) closeIcon.classList.add("hidden");
  }
}

if (btnChatToggle) {
  btnChatToggle.addEventListener("click", () => {
    setChatOpen(!isChatOpen);
  });
}

if (btnChatClose) {
  btnChatClose.addEventListener("click", () => {
    setChatOpen(false);
  });
}

if (btnHeroChatTrigger) {
  btnHeroChatTrigger.addEventListener("click", () => {
    setChatOpen(true);
  });
}

chatSuggestChips.forEach(chip => {
  chip.addEventListener("click", () => {
    if (chatInput) {
      chatInput.value = chip.dataset.prompt;
      handleChatSubmit();
    }
  });
});

/**
 * Extracts budget amount from natural language query:
 * e.g. "budget 20000", "under 20000", "rs 20000", "₹20000", "20000 rs"
 */
function extractBudgetFromText(text) {
  if (!text) return 0;
  
  // Forward regex: "budget 20000", "budget: 20000", "under 20,000", "rs 20000", "rs. 20000", "₹20000", "₹ 20000"
  const regex = /(?:budget|rs\.?|₹|under|price(?:\s*is)?)\s*:?\s*(\d[\d,]*)/i;
  const match = text.match(regex);
  if (match && match[1]) {
    const parsed = parseFloat(match[1].replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  
  // Reverse regex: "20000 rs", "20000 inr", "20000 rupees"
  const revRegex = /(\d[\d,]*)\s*(?:rs|inr|rupees)/i;
  const revMatch = text.match(revRegex);
  if (revMatch && revMatch[1]) {
    const parsed = parseFloat(revMatch[1].replace(/,/g, ""));
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  
  return 0;
}

function appendUserChatMessage(text) {
  const msgEl = document.createElement("div");
  msgEl.className = "chat-msg chat-msg-user";
  msgEl.innerHTML = `
    <div class="chat-msg-body">
      <p>${escapeHtml(text)}</p>
    </div>
  `;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function appendAssistantChatMessage(htmlContent) {
  const msgEl = document.createElement("div");
  msgEl.className = "chat-msg chat-msg-assistant";
  msgEl.innerHTML = `
    <div class="chat-msg-avatar">
      ${AI_SPARKLE_SVG}
    </div>
    <div class="chat-msg-body">
      ${htmlContent}
    </div>
  `;
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return msgEl;
}

async function handleChatSubmit() {
  if (!chatInput) return;
  const text = chatInput.value.trim();
  if (!text) return;

  appendUserChatMessage(text);
  chatInput.value = "";
  if (btnChatSend) btnChatSend.disabled = true;

  // Real animated loading indicator in the assistant slot during network request
  const typingIndicator = document.createElement("div");
  typingIndicator.className = "chat-msg chat-msg-assistant";
  typingIndicator.id = "chat-typing-bubble";
  typingIndicator.innerHTML = `
    <div class="chat-msg-avatar">
      ${AI_SPARKLE_SVG}
    </div>
    <div class="chat-typing-indicator">
      <span class="chat-typing-dot"></span>
      <span class="chat-typing-dot"></span>
      <span class="chat-typing-dot"></span>
    </div>
  `;
  chatMessages.appendChild(typingIndicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  const extractedBudget = extractBudgetFromText(text);

  try {
    const payload = {
      description: text,
      budget: extractedBudget > 0 ? extractedBudget : 20000,
      lat: 19.0760,
      lng: 72.8777
    };

    // Honest network call to real backend /match endpoint
    const data = await apiFetch("/match", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    // Remove loading indicator immediately upon response arrival
    if (typingIndicator.parentNode) {
      typingIndicator.parentNode.removeChild(typingIndicator);
    }

    const rawMatches = data.matches || [];
    // Only display genuine semantic matches (filter out 0% semantic or Weak Matches)
    const matches = rawMatches.filter(m => m.breakdown && m.breakdown.semantic > 0 && m.confidence_label !== "Weak Match");

    if (matches.length > 0) {
      const topMatches = matches.slice(0, 3);
      const cardsHtml = topMatches.map(m => {
        const item = m.listing;
        const pct = Math.round(m.final_score * 100);
        let confColorClass = "badge-weak-match";
        if (m.confidence_label === "Strong Match") confColorClass = "badge-strong-match";
        else if (m.confidence_label === "Good Match") confColorClass = "badge-good-match";
        else if (m.confidence_label === "Partial Match") confColorClass = "badge-partial-match";

        return `
          <div class="chat-result-card">
            <div class="chat-card-top">
              <span class="chat-card-title">${escapeHtml(item.title)}</span>
              <span class="badge-confidence ${confColorClass}">${AI_SPARKLE_SVG} ${escapeHtml(m.confidence_label || "Match")}</span>
            </div>
            <div class="chat-card-meta">
              <span class="chat-card-price">₹${Number(item.price).toLocaleString("en-IN")}/day</span>
              <span style="font-weight:700; color:var(--accent-indigo);">${pct}% Fit</span>
            </div>
          </div>
        `;
      }).join("");

      const content = `
        <p>I found <strong>${matches.length} option(s)</strong> that match what you're looking for:</p>
        <div class="chat-results-list">
          ${cardsHtml}
        </div>
        <button type="button" class="btn-chat-view-full">
          View full results &amp; negotiate &rarr;
        </button>
      `;

      const msgEl = appendAssistantChatMessage(content);
      const btnViewFull = msgEl.querySelector(".btn-chat-view-full");
      if (btnViewFull) {
        btnViewFull.addEventListener("click", () => {
          showView("seeker");
          const descInput = document.getElementById("match-desc");
          const budgetInput = document.getElementById("match-budget");
          if (descInput) descInput.value = text;
          if (budgetInput && extractedBudget > 0) {
            budgetInput.value = extractedBudget;
          }
          setChatOpen(false);
          // Trigger search form to populate full results view
          matchForm.dispatchEvent(new Event("submit", { cancelable: true }));
        });
      }
    } else {
      const emptyContent = `
        <p>I couldn't find a strong match for that right now. Try adjusting the details, or browse all listings below.</p>
        <button type="button" class="btn-chat-view-full" style="margin-top:8px;">Browse Seeker Portal &rarr;</button>
      `;
      const msgEl = appendAssistantChatMessage(emptyContent);
      const btnBrowse = msgEl.querySelector(".btn-chat-view-full");
      if (btnBrowse) {
        btnBrowse.addEventListener("click", () => {
          showView("seeker");
          setChatOpen(false);
        });
      }
    }
  } catch (err) {
    if (typingIndicator.parentNode) {
      typingIndicator.parentNode.removeChild(typingIndicator);
    }
    appendAssistantChatMessage("<p>Something went wrong reaching the matching engine. Please try again.</p>");
  } finally {
    if (btnChatSend) btnChatSend.disabled = false;
  }
}

if (chatForm) {
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleChatSubmit();
  });
}

// ====================================================================
// SCROLL ANIMATIONS, NUMERIC COUNTERS, & INTERACTIVE SHOWCASE HANDLERS
// ====================================================================

function initScrollAnimations() {
  const scrollElements = document.querySelectorAll(".reveal-on-scroll");

  if (!("IntersectionObserver" in window)) {
    scrollElements.forEach(el => el.classList.add("is-revealed"));
    return;
  }

  const observer = new IntersectionObserver((entries, obs) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-revealed");
        
        // Trigger rolling counters inside this element if present
        const counters = entry.target.querySelectorAll(".stat-counter");
        counters.forEach(counter => animateCounter(counter));

        obs.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: "0px 0px -40px 0px"
  });

  scrollElements.forEach(el => observer.observe(el));
}

function animateCounter(el) {
  if (el.dataset.animated === "true") return;
  el.dataset.animated = "true";

  const target = parseFloat(el.dataset.target) || 0;
  const prefix = el.dataset.prefix || "";
  const suffix = el.dataset.suffix || "";
  const duration = 1400; // ms
  const startTime = performance.now();

  function updateCount(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out cubic formula
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const currentVal = Math.round(easeProgress * target);

    el.textContent = `${prefix}${currentVal}${suffix}`;

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    } else {
      el.textContent = `${prefix}${target}${suffix}`;
    }
  }

  requestAnimationFrame(updateCount);
}

// Ambient aurora background parallax on scroll
window.addEventListener("scroll", () => {
  const auroraContainer = document.getElementById("aurora-glow-container");
  if (auroraContainer) {
    const scrollY = window.scrollY || window.pageYOffset;
    auroraContainer.style.transform = `translate3d(0, ${scrollY * 0.14}px, 0)`;
  }
}, { passive: true });

// 3D Card Tilt on Mouse Move
function init3DCardTilt() {
  const cards = document.querySelectorAll(".engine-card, .featured-asset-card, .comp-card");
  
  cards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const rotateX = ((y - centerY) / centerY) * -4;
      const rotateY = ((x - centerX) / centerX) * 4;
      
      card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-4px)`;
    });

    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

// FAQ Accordion Listeners
function initFaqAccordion() {
  const faqItems = document.querySelectorAll(".faq-item");
  faqItems.forEach(item => {
    const btn = item.querySelector(".faq-question");
    if (btn) {
      btn.addEventListener("click", () => {
        const isActive = item.classList.contains("active");
        faqItems.forEach(i => {
          i.classList.remove("active");
          const b = i.querySelector(".faq-question");
          if (b) b.setAttribute("aria-expanded", "false");
        });

        if (!isActive) {
          item.classList.add("active");
          btn.setAttribute("aria-expanded", "true");
        }
      });
    }
  });
}

// Quick Match triggers from Featured Mumbai Assets
function initFeaturedAssetTriggers() {
  const quickMatchBtns = document.querySelectorAll(".btn-quick-match");
  quickMatchBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const query = btn.dataset.query;
      const budget = btn.dataset.budget;
      const cat = btn.dataset.cat;

      showView("seeker");
      const descInput = document.getElementById("match-desc");
      const budgetInput = document.getElementById("match-budget");
      const catSelect = document.getElementById("match-type");

      if (descInput) descInput.value = query;
      if (budgetInput) budgetInput.value = budget;
      if (catSelect) catSelect.value = cat;

      showAlert(`Pre-loaded asset criteria! Generating AI matches...`, "info");
      matchForm.dispatchEvent(new Event("submit", { cancelable: true }));
    });
  });
}

// Bottom CTA Banner Handlers
const btnCtaBrowse = document.getElementById("btn-cta-browse");
const btnCtaHost = document.getElementById("btn-cta-host");
const btnCtaChat = document.getElementById("btn-cta-chat");

if (btnCtaBrowse) {
  btnCtaBrowse.addEventListener("click", () => {
    showView("seeker");
  });
}

if (btnCtaHost) {
  btnCtaHost.addEventListener("click", () => {
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
}

if (btnCtaChat) {
  btnCtaChat.addEventListener("click", () => {
    setChatOpen(true);
  });
}

// Initialize Landing Page Enhancements
initScrollAnimations();
init3DCardTilt();
initFaqAccordion();
initFeaturedAssetTriggers();

// ====================================================================
// BACKEND SERVER CONNECTION & RENDER STATUS CONTROLLER
// ====================================================================
const btnServerStatus = document.getElementById("btn-server-status");
const serverStatusDot = document.getElementById("server-status-dot");
const serverStatusText = document.getElementById("server-status-text");

const modalServerConfig = document.getElementById("modal-server-config");
const btnCloseServerModal = document.getElementById("btn-close-server-modal");
const serverCurrentUrl = document.getElementById("server-current-url");
const serverPingBadge = document.getElementById("server-ping-badge");
const serverPingDot = document.getElementById("server-ping-dot");
const serverPingText = document.getElementById("server-ping-text");
const pingLatencyText = document.getElementById("ping-latency-text");
const btnTestPing = document.getElementById("btn-test-ping");
const inputBackendUrl = document.getElementById("input-backend-url");
const btnSaveBackendUrl = document.getElementById("btn-save-backend-url");
const btnResetLocalhost = document.getElementById("btn-reset-localhost");

function updateServerStatusPill(statusClass, label) {
  if (serverStatusDot) {
    serverStatusDot.className = "server-status-dot " + statusClass;
  }
  if (serverStatusText) {
    serverStatusText.textContent = label;
  }
}

async function testBackendPing(showLatency = false) {
  const root = getApiRoot();
  if (serverCurrentUrl) serverCurrentUrl.textContent = root;
  if (serverPingDot) serverPingDot.className = "server-status-dot waking";
  if (serverPingText) serverPingText.textContent = "Pinging...";
  if (pingLatencyText) pingLatencyText.textContent = "";

  const start = performance.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${root}/health`, { signal: controller.signal }).catch(async () => {
      // Fallback in case /health isn't caught
      return await fetch(`${root}/`, { signal: controller.signal });
    });
    clearTimeout(timeoutId);

    const elapsed = Math.round(performance.now() - start);

    if (res && res.ok) {
      if (serverPingDot) serverPingDot.className = "server-status-dot online";
      if (serverPingText) serverPingText.textContent = `Online (${elapsed}ms)`;
      if (pingLatencyText && showLatency) pingLatencyText.textContent = `Connected! Latency: ${elapsed}ms. Service is healthy.`;
      const isLocal = root.includes("127.0.0.1") || root.includes("localhost");
      updateServerStatusPill("online", isLocal ? "API: Local" : "API: Render");
    } else {
      throw new Error(`Status ${res ? res.status : "Unknown"}`);
    }
  } catch (err) {
    const elapsed = Math.round(performance.now() - start);
    if (serverPingDot) serverPingDot.className = "server-status-dot waking";
    if (serverPingText) serverPingText.textContent = root.includes("onrender.com") ? "Sleeping / Waking..." : "Offline";
    if (pingLatencyText && showLatency) {
      if (root.includes("onrender.com")) {
        pingLatencyText.textContent = "Render free tier is spinning up (~45-60s cold start). Click Ping again in 20 seconds.";
      } else {
        pingLatencyText.textContent = `Could not reach ${root}. Make sure local uvicorn is running on port 8000.`;
      }
    }
    updateServerStatusPill("waking", root.includes("onrender.com") ? "Render Waking" : "API: Offline");
  }
}

function openServerConfigModal() {
  if (!modalServerConfig) return;
  const root = getApiRoot();
  if (serverCurrentUrl) serverCurrentUrl.textContent = root;
  if (inputBackendUrl) {
    inputBackendUrl.value = root.includes("127.0.0.1") || root.includes("localhost") ? "" : root;
  }
  modalServerConfig.classList.remove("hidden");
  testBackendPing(true);
}

function closeServerConfigModal() {
  if (modalServerConfig) modalServerConfig.classList.add("hidden");
}

window.openServerConfigModal = openServerConfigModal;

if (btnServerStatus) {
  btnServerStatus.addEventListener("click", openServerConfigModal);
}
if (btnCloseServerModal) {
  btnCloseServerModal.addEventListener("click", closeServerConfigModal);
}
if (btnTestPing) {
  btnTestPing.addEventListener("click", () => testBackendPing(true));
}
if (btnSaveBackendUrl) {
  btnSaveBackendUrl.addEventListener("click", () => {
    const val = inputBackendUrl ? inputBackendUrl.value.trim() : "";
    if (!val) {
      alert("Please enter your live Render backend URL, e.g. https://your-service.onrender.com");
      return;
    }
    window.setBackendUrl(val);
  });
}
if (btnResetLocalhost) {
  btnResetLocalhost.addEventListener("click", () => {
    window.resetBackendUrl();
  });
}

// Initial silent ping to establish header connection pill state
testBackendPing(false);


