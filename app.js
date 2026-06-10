const STORAGE_KEY = "world-picks-2026";
const state = loadState();
let matches = [];
let activeRound = null;

const matchesList = document.querySelector("#matches-list");
const playerName = document.querySelector("#player-name");
const progressCount = document.querySelector("#progress-count");
const progressBar = document.querySelector("#progress-bar");
const progressTrack = document.querySelector(".progress-track");
const submitPanel = document.querySelector(".submit-panel");
const submitTitle = document.querySelector("#submit-title");
const submitHint = document.querySelector("#submit-hint");
const submitButton = document.querySelector("#submit-button");
const resultDialog = document.querySelector("#result-dialog");
const closeDialog = document.querySelector("#close-dialog");
const shareText = document.querySelector("#share-text");
const shareButton = document.querySelector("#share-button");
const copyButton = document.querySelector("#copy-button");
const toast = document.querySelector("#toast");
const roundName = document.querySelector("#round-name");
const roundKicker = document.querySelector("#round-kicker");
const dataStatus = document.querySelector("#data-status");

playerName.value = state.name;

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      name: saved?.name || "",
      picks: saved?.picks || {},
    };
  } catch {
    return { name: "", picks: {} };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatKickoff(value) {
  return new Intl.DateTimeFormat("ar-SA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function matchKey(match) {
  return String(match.id);
}

function renderLoading() {
  matchesList.innerHTML = Array.from({ length: 4 }, () => `
    <div class="match-card skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-team"></div>
      <div class="skeleton skeleton-center"></div>
      <div class="skeleton skeleton-team"></div>
    </div>
  `).join("");
}

function renderError(message) {
  matchesList.innerHTML = `
    <div class="data-error">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 9v4m0 4h.01M10.3 3.8 2.2 18a2 2 0 0 0 1.7 3h16.2a2 2 0 0 0 1.7-3L13.7 3.8a2 2 0 0 0-3.4 0Z"/>
      </svg>
      <strong>تعذر تحميل المباريات</strong>
      <span>${escapeHtml(message)}</span>
      <button id="retry-button" class="secondary-button" type="button">إعادة المحاولة</button>
    </div>
  `;
  document.querySelector("#retry-button").addEventListener("click", loadMatches);
}

function renderMatches() {
  matchesList.innerHTML = matches
    .map((match, index) => {
      const currentPick = state.picks[matchKey(match)];
      return `
        <article class="match-card">
          <div class="team-pick home">
            <button
              class="pick-button ${currentPick === "home" ? "selected" : ""}"
              type="button"
              data-match="${match.id}"
              data-pick="home"
              aria-pressed="${currentPick === "home"}"
              aria-label="اختيار ${escapeHtml(match.home.name)} للفوز"
            >
              <span class="flag-frame">
                <img class="flag" src="${match.home.flag}" alt="${escapeHtml(match.home.name)} flag" />
              </span>
              <span class="team-name">${escapeHtml(match.home.name)}</span>
              <span class="team-code">${escapeHtml(match.home.code)}</span>
            </button>
          </div>

          <div class="match-meta">
            <span class="match-number">المباراة ${index + 1}</span>
            <span class="kickoff">${formatKickoff(match.kickoff)}</span>
            <button
              class="draw-button ${currentPick === "draw" ? "selected" : ""}"
              type="button"
              data-match="${match.id}"
              data-pick="draw"
              aria-pressed="${currentPick === "draw"}"
            >
              تعادل
            </button>
          </div>

          <div class="team-pick away">
            <button
              class="pick-button ${currentPick === "away" ? "selected" : ""}"
              type="button"
              data-match="${match.id}"
              data-pick="away"
              aria-pressed="${currentPick === "away"}"
              aria-label="اختيار ${escapeHtml(match.away.name)} للفوز"
            >
              <span class="flag-frame">
                <img class="flag" src="${match.away.flag}" alt="${escapeHtml(match.away.name)} flag" />
              </span>
              <span class="team-name">${escapeHtml(match.away.name)}</span>
              <span class="team-code">${escapeHtml(match.away.code)}</span>
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function updateProgress() {
  const completed = matches.filter((match) => state.picks[matchKey(match)]).length;
  const total = matches.length;
  const isComplete = total > 0 && completed === total;
  const hasName = state.name.trim().length > 0;

  progressCount.textContent = `${completed} / ${total}`;
  progressBar.style.width = total ? `${(completed / total) * 100}%` : "0%";
  progressTrack.setAttribute("aria-valuemax", total);
  progressTrack.setAttribute("aria-valuenow", completed);
  submitPanel.classList.toggle("ready", isComplete && hasName);
  submitButton.disabled = !isComplete || !hasName;

  if (!total) {
    submitTitle.textContent = "جاري تحميل المباريات";
    submitHint.textContent = "يتم جلب جدول المباريات مباشرة.";
  } else if (!isComplete) {
    const remaining = total - completed;
    submitTitle.textContent = `متبقي ${remaining} ${remaining === 1 ? "مباراة" : "مباريات"}`;
    submitHint.textContent = "يتم حفظ اختياراتك تلقائياً.";
  } else if (!hasName) {
    submitTitle.textContent = "اكتب اسمك للإرسال";
    submitHint.textContent = "اكتملت جميع اختياراتك.";
  } else {
    submitTitle.textContent = "اكتملت جميع التوقعات";
    submitHint.textContent = "راجعها ثم أرسلها للمجموعة.";
  }
}

function makeSummary() {
  const lines = matches.map((match, index) => {
    const pick = state.picks[matchKey(match)];
    const choice = pick === "home" ? match.home.name : pick === "away" ? match.away.name : "تعادل";
    return `${index + 1}. ${match.home.name} ضد ${match.away.name}: ${choice}`;
  });

  return [
    `توقعات كأس العالم 2026 - ${activeRound.name}`,
    `اللاعب: ${state.name.trim()}`,
    "",
    ...lines,
    "",
    "تم اعتماد التوقعات.",
  ].join("\n");
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

async function copySummary() {
  try {
    await navigator.clipboard.writeText(shareText.value);
    copyButton.textContent = "تم النسخ";
    showToast("تم نسخ التوقعات");
    window.setTimeout(() => {
      copyButton.textContent = "نسخ النص";
    }, 1800);
  } catch {
    shareText.select();
    document.execCommand("copy");
    showToast("تم نسخ التوقعات");
  }
}

async function loadMatches() {
  renderLoading();
  dataStatus.textContent = "جاري تحميل المباريات";
  dataStatus.classList.add("loading");

  try {
    const response = await fetch("/api/matches", { cache: "no-store" });
    if (!response.ok) throw new Error("خدمة المباريات غير متاحة مؤقتاً.");

    const data = await response.json();
    matches = data.matches;
    activeRound = data.round;
    roundName.textContent = activeRound.name;
    roundKicker.textContent = activeRound.label;
    dataStatus.textContent = data.cached ? "بيانات محفوظة مؤقتاً" : "بيانات مباشرة";
    dataStatus.classList.remove("loading");
    renderMatches();
    updateProgress();
  } catch (error) {
    matches = [];
    dataStatus.textContent = "خطأ في الاتصال";
    dataStatus.classList.remove("loading");
    renderError(error.message);
    updateProgress();
  }
}

matchesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-match]");
  if (!button) return;
  state.picks[button.dataset.match] = button.dataset.pick;
  saveState();
  renderMatches();
  updateProgress();
});

playerName.addEventListener("input", () => {
  state.name = playerName.value;
  saveState();
  updateProgress();
});

submitButton.addEventListener("click", () => {
  shareText.value = makeSummary();
  resultDialog.showModal();
});

closeDialog.addEventListener("click", () => resultDialog.close());
resultDialog.addEventListener("click", (event) => {
  if (event.target === resultDialog) resultDialog.close();
});

shareButton.addEventListener("click", async () => {
  const summary = shareText.value;
  if (navigator.share) {
    try {
      await navigator.share({ title: `توقعات كأس العالم - ${activeRound.name}`, text: summary });
    } catch (error) {
      if (error.name !== "AbortError") await copySummary();
    }
    return;
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank", "noopener,noreferrer");
});

copyButton.addEventListener("click", copySummary);
renderLoading();
updateProgress();
loadMatches();
