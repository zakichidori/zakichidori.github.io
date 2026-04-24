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

let activeMatchButton = null;
const sourceHealthCache = new Map();
const allowedSports = new Set(["basketball", "football", "american-football", "american football"]);

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
  for (const match of matches) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "match-btn checking";
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
    icon.textContent = "x";
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
    streamPlayer.removeAttribute("src");
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
    option.textContent = `#${stream.streamNo} - ${stream.language} ${stream.hd ? "(HD)" : "(SD)"} [${stream.source}]`;
    streamSelect.appendChild(option);
    if (index === 0) {
      streamPlayer.src = stream.embedUrl;
    }
  });

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
    return;
  }

  button.classList.remove("no-source");
  button.classList.add("has-stream");
  const timeState = getTimeState(match.date);
  applyStatusIcon(button, timeState);
}

function applyTheme(theme) {
  document.body.dataset.theme = theme;
  siteTitle.textContent = theme === "ypk" ? "YPK Streaming" : "Chidori Hub Streaming";
  siteKicker.textContent = theme === "ypk" ? "Live Fire Night" : "Live Chidori Night";
  siteSubtext.textContent = theme === "ypk"
    ? "Fiery streaming energy with hot live games and fast source switches."
    : "Electric lightning vibes with auto-loaded games and best source stream defaults.";
}

function unlockSite() {
  if (passwordInput.value === "chidoriisking") {
    siteLock.classList.add("unlocked");
    passwordStatus.textContent = "";
    return;
  }
  passwordStatus.textContent = "Wrong password.";
  passwordInput.value = "";
}

async function loadStreams(match) {
  try {
    setStatus("Loading streams...");
    streamSelect.disabled = true;
    streamSelect.innerHTML = `<option value="">Loading...</option>`;

    const best = await getBestStreamsForMatch(match);
    const allStreams = best.streams;

    renderStreams(allStreams, match.title);
  } catch (error) {
    setStatus(`Could not load streams: ${error.message}`);
    streamSelect.disabled = true;
    streamPlayer.removeAttribute("src");
  }
}

async function loadMatches(sportId) {
  try {
    setStatus("Loading matches...");
    renderEmptyMatches("Loading matches...");
    streamSelect.disabled = true;
    streamSelect.innerHTML = `<option value="">No streams loaded</option>`;
    streamPlayer.removeAttribute("src");
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
      const id = (sport.id || "").toLowerCase();
      const name = (sport.name || "").toLowerCase();
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
passwordInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") unlockSite();
});

streamSelect.addEventListener("change", () => {
  if (streamSelect.value) {
    streamPlayer.src = streamSelect.value;
  }
});

applyTheme("chidori");
init();
