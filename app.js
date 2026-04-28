const API_BASE = "https://streamed.pk/api";

const sportSelect = document.getElementById("sportSelect");
const statusText = document.getElementById("statusText");
const matchesList = document.getElementById("matchesList");
const streamSelect = document.getElementById("streamSelect");
const streamPlayer = document.getElementById("streamPlayer");
const currentMatchTitle = document.getElementById("currentMatchTitle");
const themeSelect = document.getElementById("themeSelect");
const siteTitle = document.getElementById("siteTitle");
const siteKicker = document.getElementById("siteKicker");
const siteSubtext = document.getElementById("siteSubtext");
const siteLock = document.getElementById("siteLock");
const passwordInput = document.getElementById("passwordInput");
const unlockButton = document.getElementById("unlockButton");
const passwordStatus = document.getElementById("passwordStatus");
const playerLoadingOverlay = document.getElementById("playerLoadingOverlay");
const heroLogo = document.querySelector(".hero-logo");
const ypkLogo = document.querySelector(".ypk-logo");

let activeMatchButton = null;
// FIX: cache is now keyed per sport+match so stale data doesn't bleed across sport switches
let sourceHealthCache = new Map();
const allowedSports = new Set(["basketball", "football", "american-football", "american-football"]);

function setStatus(message) {
  statusText.textContent = message;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleString("en-US", {
    timeZone: "America/Chicago",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }) + " Minnesota Time";
}

async function getJSON(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed (${response.status})`);
  }
  return response.json();
}

function renderEmptyMatches(text) {
  matchesList.innerHTML = `<p class="status-text">${text}</p>`;
}

function renderMatches(matches) {
  if (!matches.length) {
    renderEmptyMatches("No matches found for this sport.");
    return;
  }

  matchesList.innerHTML = "";

  // FIX: Sort so "no source" matches sink to the bottom after health checks resolve.
  // We render all initially, then let updateMatchHealth reorder visually via CSS ordering.
  for (const match of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-btn checking";
    button.dataset.matchId = match.id;
    button.style.order = "1";
    button.innerHTML = `
      <span class="match-status-icon status-checking" title="Checking stream status">?</span>
      <span class="match-title">${match.title}</span>
      <span class="match-time">${formatDate(match.date)}</span>
    `;

    button.addEventListener("click", () => {
      if (activeMatchButton) activeMatchButton.classList.remove("active");
      button.classList.add("active");
      activeMatchButton = button;
      loadStreams(match);
    });

    matchesList.appendChild(button);
    updateMatchHealth(match, button);
  }
}

function getTimeState(matchDate) {
  return Number(matchDate) > Date.now() ? "upcoming" : "live";
}

function getMatchPriority(match, hasWorkingSource) {
  if (!hasWorkingSource) return 2;
  return getTimeState(match.date) === "live" ? 0 : 1;
}

function applyStatusIcon(button, statusType) {
  const icon = button.querySelector(".match-status-icon");
  if (!icon) return;

  icon.className = `match-status-icon status-${statusType}`;
  if (statusType === "live") {
    icon.textContent = "L";
    icon.title = "Live and working now";
  } else if (statusType === "upcoming") {
    icon.textContent = "⏰";
    icon.title = "Not started yet";
  } else if (statusType === "no-source") {
    icon.textContent = "✕";
    icon.title = "No working source";
  } else {
    icon.textContent = "?";
    icon.title = "Checking stream status";
  }
}

function renderStreams(streams, matchTitle) {
  streamSelect.innerHTML = "";
  currentMatchTitle.textContent = matchTitle;

  if (!streams.length) {
    streamSelect.disabled = true;
    streamSelect.innerHTML = `<option value="">No streams available</option>`;
    // FIX: use src="" instead of removeAttribute("src") — removing src doesn't stop iframe playback
    streamPlayer.src = "";
    setStatus("No streams found for the selected match.");
    return;
  }

  const sorted = [...streams].sort((a, b) => {
    if (a.hd !== b.hd) return a.hd ? -1 : 1;
    return (a.streamNo || 999) - (b.streamNo || 999);
  });

  sorted.forEach((stream, index) => {
    const option = document.createElement("option");
    option.value = stream.embedUrl;
    option.textContent = `#${stream.streamNo} — ${stream.language} ${stream.hd ? "(HD)" : "(SD)"} [${stream.source}]`;
    streamSelect.appendChild(option);
  });

  // FIX: set value and src AFTER options are appended so the DOM reflects the choice correctly
  if (sorted.length > 0) {
    streamSelect.value = sorted[0].embedUrl;
    streamPlayer.src = sorted[0].embedUrl;
  }

  streamSelect.disabled = false;
  setStatus(`Loaded ${streams.length} stream(s).`);
}

async function getBestStreamsForMatch(match) {
  if (sourceHealthCache.has(match.id)) {
    return sourceHealthCache.get(match.id);
  }

  const result = { hasWorkingSource: false, streams: [] };
  for (const source of match.sources || []) {
    try {
      const streams = await getJSON(`${API_BASE}/stream/${source.source}/${source.id}`);
      if (Array.isArray(streams) && streams.length) {
        result.hasWorkingSource = true;
        result.streams = streams.map((stream) => ({ ...stream, source: stream.source || source.source }));
        break;
      }
    } catch (_) {
      // Ignore individual source failures and continue checking.
    }
  }

  sourceHealthCache.set(match.id, result);
  return result;
}

async function updateMatchHealth(match, button) {
  applyStatusIcon(button, "checking");
  const sourceState = await getBestStreamsForMatch(match);
  button.classList.remove("checking");
  if (!sourceState.hasWorkingSource) {
    button.classList.add("no-source");
    button.classList.remove("has-stream");
    applyStatusIcon(button, "no-source");
    button.style.order = String(getMatchPriority(match, false));
    return;
  }

  button.classList.remove("no-source");
  button.classList.add("has-stream");
  button.style.order = String(getMatchPriority(match, true));
  const timeState = getTimeState(match.date);
  applyStatusIcon(button, timeState);
}

function setPlayerLoading(loading) {
  if (playerLoadingOverlay) {
    playerLoadingOverlay.style.display = loading ? "grid" : "none";
  }
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  const isYpkTheme = theme === "ypk";
  heroLogo.style.display = isYpkTheme ? "none" : "block";
  ypkLogo.style.display = isYpkTheme ? "flex" : "none";

  if (theme === "micheal-scofield") {
    siteKicker.textContent = "micheal scofield streaming";
    siteTitle.textContent = "\"I choose to have faith, because without that I have nothing.\"";
    siteSubtext.textContent = "";
    heroLogo.src = "https://images4.alphacoders.com/797/thumb-1920-797164.jpg";
    heroLogo.alt = "Micheal Scofield theme image";
    return;
  }

  if (theme === "rasengan") {
    siteKicker.textContent = "rasengan streaming";
    siteTitle.textContent = "\"Hard work is worthless for those that don't believe in themselves.\"";
    siteSubtext.textContent = "";
    heroLogo.src = "https://i.ibb.co/nMb9XVdx/0761f2f1-6202-4958-8782-561e54ea39cb.jpg";
    heroLogo.alt = "Rasengan theme image";
    return;
  }

  if (theme === "ypk") {
    siteKicker.textContent = "ypk streaming";
    siteTitle.textContent = "\"Pain is temporary. Pride is forever.\"";
    siteSubtext.textContent = "";
    heroLogo.src = "https://i.ibb.co/whfP7LmP/c-Users-zaki-App-Data-Roaming-Cursor-User-workspace-Storage-b2ff2dc92f04416442a5b765bc83d43b-images.png";
    heroLogo.alt = "YPK theme logo";
    return;
  }

  siteKicker.textContent = "chidori hub streaming";
  siteTitle.textContent = "\"People live their lives bound by what they accept as correct and true.\"";
  siteSubtext.textContent = "";
  heroLogo.src = "https://i.ibb.co/whfP7LmP/c-Users-zaki-App-Data-Roaming-Cursor-User-workspace-Storage-b2ff2dc92f04416442a5b765bc83d43b-images.png";
  heroLogo.alt = "ChidoriHub logo";
}

function unlockSite() {
  if (passwordInput.value.trim().toLowerCase() === "bashir") {
    siteLock.classList.add("unlocked");
    passwordStatus.textContent = "";
    return;
  }
  passwordStatus.textContent = "Wrong last name. Try again.";
  passwordInput.value = "";
  passwordInput.focus();
}

async function loadStreams(match) {
  try {
    setStatus("Loading streams...");
    setPlayerLoading(true);
    streamSelect.disabled = true;
    streamSelect.innerHTML = `<option value="">Loading...</option>`;
    streamPlayer.src = "";

    const best = await getBestStreamsForMatch(match);
    const allStreams = best.streams;

    renderStreams(allStreams, match.title);
  } catch (error) {
    setStatus(`Could not load streams: ${error.message}`);
    streamSelect.disabled = true;
    streamPlayer.src = "";
  } finally {
    setPlayerLoading(false);
  }
}

async function loadMatches(sportId) {
  // FIX: clear cache when switching sports so stale health data doesn't persist
  sourceHealthCache = new Map();

  try {
    setStatus("Loading matches...");
    renderEmptyMatches("Loading matches...");
    streamSelect.disabled = true;
    streamSelect.innerHTML = `<option value="">No streams loaded</option>`;
    // FIX: use src="" instead of removeAttribute("src")
    streamPlayer.src = "";
    currentMatchTitle.textContent = "Select a match";

    const endpoint = sportId ? `${API_BASE}/matches/${sportId}` : `${API_BASE}/matches/live`;
    const matches = await getJSON(endpoint);
    const sortedMatches = [...matches].sort((a, b) => a.date - b.date);
    renderMatches(sortedMatches);
    setStatus(`Loaded ${sortedMatches.length} matches.`);
  } catch (error) {
    renderEmptyMatches("Could not load matches.");
    setStatus(`Could not load matches: ${error.message}`);
  }
}

async function init() {
  try {
    const sports = await getJSON(`${API_BASE}/sports`);
    sportSelect.innerHTML = "";

    const filteredSports = sports.filter((sport) => {
      // FIX: normalize the id before checking — some APIs return "american football" with a space
      const id = (sport.id || "").toLowerCase().replace(/\s+/g, "-");
      const name = (sport.name || "").toLowerCase().replace(/\s+/g, "-");
      return allowedSports.has(id) || allowedSports.has(name);
    });

    if (!filteredSports.length) {
      throw new Error("No allowed sports returned by API.");
    }

    for (const sport of filteredSports) {
      const option = document.createElement("option");
      option.value = sport.id;
      option.textContent = sport.name;
      sportSelect.appendChild(option);
    }

    const basketball = filteredSports.find((s) => s.id === "basketball");
    if (basketball) {
      sportSelect.value = "basketball";
    } else if (filteredSports.length) {
      sportSelect.value = filteredSports[0].id;
    }

    await loadMatches(sportSelect.value);
  } catch (error) {
    setStatus(`Could not load sports: ${error.message}`);
    sportSelect.innerHTML = `<option value="">Sports unavailable</option>`;
    renderEmptyMatches("Sports API unavailable.");
  }
}

sportSelect.addEventListener("change", () => {
  loadMatches(sportSelect.value);
});

themeSelect.addEventListener("change", () => {
  applyTheme(themeSelect.value);
});

unlockButton.addEventListener("click", unlockSite);
// FIX: keyup instead of keydown prevents double-fire when key is held
passwordInput.addEventListener("keyup", (event) => {
  if (event.key === "Enter") unlockSite();
});

streamSelect.addEventListener("change", () => {
  if (streamSelect.value) {
    setPlayerLoading(true);
    streamPlayer.src = streamSelect.value;
  }
});

// Clear loading overlay once iframe actually loads
streamPlayer.addEventListener("load", () => {
  setPlayerLoading(false);
});

applyTheme("chidori");
init();
