const STORAGE_KEY = "world-picks-2026";
const state = { scores: {} };
let matches = [];
let activeRound = null;
let shareBlob = null;
let roundTimer = null;
let currentUser = null;

const matchesList = document.querySelector("#matches-list");
const progressCount = document.querySelector("#progress-count");
const progressBar = document.querySelector("#progress-bar");
const progressTrack = document.querySelector(".progress-track");
const submitPanel = document.querySelector(".submit-panel");
const submitTitle = document.querySelector("#submit-title");
const submitHint = document.querySelector("#submit-hint");
const submitButton = document.querySelector("#submit-button");
const submitLabel = document.querySelector("#submit-label");
const resultDialog = document.querySelector("#result-dialog");
const closeDialog = document.querySelector("#close-dialog");
const shareImage = document.querySelector("#share-image");
const shareButton = document.querySelector("#share-button");
const downloadButton = document.querySelector("#download-button");
const toast = document.querySelector("#toast");
const roundName = document.querySelector("#round-name");
const roundKicker = document.querySelector("#round-kicker");
const accountName = document.querySelector("#account-name");
const submitUsername = document.querySelector("#submit-username");
const adminLink = document.querySelector("#admin-link");
const logoutButton = document.querySelector("#logout-button");

function loadUserState() {
  try {
    const saved = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${currentUser.id}`));
    const scores = {};
    for (const [key, value] of Object.entries(saved?.scores || {})) {
      if (value && typeof value === "object") scores[key] = value;
    }
    return scores;
  } catch {
    return {};
  }
}

function saveState() {
  if (!currentUser) return;
  localStorage.setItem(
    `${STORAGE_KEY}:${currentUser.id}`,
    JSON.stringify({ scores: state.scores })
  );
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

function scoreFor(match) {
  return state.scores[matchKey(match)] || { home: "", away: "" };
}

function isComplete(match) {
  const score = scoreFor(match);
  return score.home !== "" && score.away !== "";
}

function outcomeFor(match) {
  if (!isComplete(match)) return null;
  const score = scoreFor(match);
  if (Number(score.home) > Number(score.away)) return "home";
  if (Number(score.home) < Number(score.away)) return "away";
  return "draw";
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
  matchesList.innerHTML = matches.map((match, index) => {
    const score = scoreFor(match);
    const outcome = outcomeFor(match);
    return `
      <article class="match-card ${outcome ? "completed" : ""}">
        <div class="team-side ${outcome === "home" ? "winner" : ""}">
          <span class="flag-frame">
            <img class="flag" src="${match.home.flag}" alt="علم ${escapeHtml(match.home.name)}" />
          </span>
          <span class="team-name">${escapeHtml(match.home.name)}</span>
          <input
            class="score-input"
            type="number"
            inputmode="numeric"
            min="0"
            max="20"
            step="1"
            value="${score.home}"
            ${activeRound.locked ? "disabled" : ""}
            data-match="${match.id}"
            data-team="home"
            aria-label="أهداف ${escapeHtml(match.home.name)}"
          />
        </div>

        <div class="match-meta">
          <span class="match-number">المباراة ${index + 1}</span>
          <span class="kickoff">${formatKickoff(match.kickoff)}</span>
          <span class="outcome-label">${outcome === "draw" ? "تعادل" : outcome ? "فوز" : "النتيجة"}</span>
        </div>

        <div class="team-side away ${outcome === "away" ? "winner" : ""}">
          <span class="flag-frame">
            <img class="flag" src="${match.away.flag}" alt="علم ${escapeHtml(match.away.name)}" />
          </span>
          <span class="team-name">${escapeHtml(match.away.name)}</span>
          <input
            class="score-input"
            type="number"
            inputmode="numeric"
            min="0"
            max="20"
            step="1"
            value="${score.away}"
            ${activeRound.locked ? "disabled" : ""}
            data-match="${match.id}"
            data-team="away"
            aria-label="أهداف ${escapeHtml(match.away.name)}"
          />
        </div>
      </article>
    `;
  }).join("");
}

function updateProgress() {
  const completed = matches.filter(isComplete).length;
  const total = matches.length;
  const allComplete = total > 0 && completed === total;
  const isLocked = Boolean(activeRound?.locked);

  progressCount.textContent = `${completed} / ${total}`;
  progressBar.style.width = total ? `${(completed / total) * 100}%` : "0%";
  progressTrack.setAttribute("aria-valuemax", total);
  progressTrack.setAttribute("aria-valuenow", completed);
  submitPanel.classList.toggle("ready", allComplete && !isLocked);
  submitButton.disabled = !allComplete || isLocked;

  if (isLocked) {
    submitTitle.textContent = "أُغلقت توقعات هذه الجولة";
    submitHint.textContent = "بدأت أول مباراة ولا يمكن تعديل أو إرسال التوقعات.";
  } else if (!total) {
    submitTitle.textContent = "جاري تحميل المباريات";
    submitHint.textContent = "يتم جلب جدول المباريات مباشرة.";
  } else if (!allComplete) {
    const remaining = total - completed;
    submitTitle.textContent = `متبقي ${remaining} ${remaining === 1 ? "مباراة" : "مباريات"}`;
    submitHint.textContent = "أدخل نتيجة رقمية لكل مباراة.";
  } else {
    submitTitle.textContent = "اكتملت جميع التوقعات";
    submitHint.textContent = "أنشئ صورة التوقعات وشاركها.";
  }
}

function scheduleRoundClosure() {
  window.clearTimeout(roundTimer);
  if (!activeRound?.closesAt || activeRound.locked) return;

  const serverTime = activeRound.serverTime
    ? new Date(activeRound.serverTime).getTime()
    : Date.now();
  const delay = new Date(activeRound.closesAt).getTime() - serverTime;
  if (delay <= 0) {
    loadMatches();
    return;
  }

  roundTimer = window.setTimeout(() => {
    submitButton.disabled = true;
    matchesList.querySelectorAll(".score-input").forEach((input) => {
      input.disabled = true;
    });
    loadMatches();
  }, Math.min(delay + 250, 2147483647));
}

function roundedRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function drawText(context, text, x, y, options = {}) {
  context.fillStyle = options.color || "#f1f5f2";
  context.font = `${options.weight || 500} ${options.size || 28}px "IBM Plex Sans Arabic", Arial`;
  context.textAlign = options.align || "right";
  context.direction = "rtl";
  context.fillText(text, x, y);
}

async function loadCanvasImage(url) {
  try {
    const highResolutionUrl = url.replace("/w160/", "/w320/");
    const response = await fetch(highResolutionUrl);
    if (!response.ok) return null;
    const blob = await response.blob();
    if ("createImageBitmap" in window) return await createImageBitmap(blob);

    const objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    URL.revokeObjectURL(objectUrl);
    return image;
  } catch {
    return null;
  }
}

function drawFlag(context, image, x, y, width = 54, height = 38) {
  context.save();
  context.beginPath();
  context.roundRect(x, y, width, height, 6);
  context.clip();
  if (image) {
    context.drawImage(image, x, y, width, height);
  } else {
    context.fillStyle = "#26312c";
    context.fillRect(x, y, width, height);
  }
  context.restore();
  context.strokeStyle = "rgba(255,255,255,.18)";
  context.lineWidth = 1;
  context.beginPath();
  context.roundRect(x, y, width, height, 6);
  context.stroke();
}

async function createPredictionImage() {
  await document.fonts.ready;
  const flags = await Promise.all(
    matches.flatMap((match) => [
      loadCanvasImage(match.home.flag),
      loadCanvasImage(match.away.flag),
    ])
  );
  const scale = 2;
  const width = 1080;
  const rowHeight = 80;
  const height = 220 + matches.length * rowHeight;
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  context.fillStyle = "#070b0a";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#58e29b";
  context.fillRect(0, 0, 12, height);

  drawText(context, "توقعات كأس العالم 2026", width - 70, 72, { size: 42, weight: 700 });
  drawText(context, activeRound.name, width - 70, 116, { size: 25, color: "#58e29b", weight: 600 });
  drawText(context, `اللاعب: ${currentUser.username}`, width - 70, 172, { size: 29, weight: 600 });

  matches.forEach((match, index) => {
    const y = 202 + index * rowHeight;
    const score = scoreFor(match);
    const outcome = outcomeFor(match);
    const cardHeight = rowHeight - 10;
    context.fillStyle = index % 2 ? "#0d1311" : "#121a17";
    roundedRect(context, 50, y, width - 100, cardHeight, 12);

    if (outcome === "home") {
      context.fillStyle = "#164a35";
      roundedRect(context, width / 2 + 72, y + 6, width / 2 - 128, cardHeight - 12, 10);
    } else if (outcome === "away") {
      context.fillStyle = "#164a35";
      roundedRect(context, 56, y + 6, width / 2 - 128, cardHeight - 12, 10);
    }

    drawFlag(context, flags[index * 2], width - 130, y + 16);
    drawFlag(context, flags[index * 2 + 1], 76, y + 16);

    drawText(context, match.home.name, width - 150, y + 44, {
      size: 22,
      weight: outcome === "home" ? 700 : 600,
      color: outcome === "home" ? "#8bf0b8" : "#f1f5f2",
    });
    drawText(context, `${score.home}  -  ${score.away}`, width / 2, y + 46, {
      size: 29,
      weight: 700,
      color: "#d7f45c",
      align: "center",
    });
    drawText(context, match.away.name, 150, y + 44, {
      size: 22,
      weight: outcome === "away" ? 700 : 600,
      color: outcome === "away" ? "#8bf0b8" : "#f1f5f2",
      align: "left",
    });
  });

  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

function downloadImage() {
  if (!shareBlob) return;
  const url = URL.createObjectURL(shareBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `توقعات-${currentUser.username}.png`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.setTimeout(() => toast.classList.remove("visible"), 2200);
}

async function loadMatches() {
  renderLoading();

  try {
    const response = await fetch("/api/matches", { cache: "no-store" });
    if (!response.ok) throw new Error("خدمة المباريات غير متاحة مؤقتاً.");
    const data = await response.json();
    matches = data.matches;
    activeRound = data.round;
    roundName.textContent = activeRound.name;
    roundKicker.textContent = activeRound.label;
    renderMatches();
    updateProgress();
    scheduleRoundClosure();
  } catch (error) {
    matches = [];
    renderError(error.message);
    updateProgress();
  }
}

matchesList.addEventListener("input", (event) => {
  const input = event.target.closest(".score-input");
  if (!input) return;

  const numericValue = Number(input.value);
  const value =
    input.value === "" || !Number.isFinite(numericValue)
      ? ""
      : String(Math.max(0, Math.min(20, numericValue)));
  input.value = value;
  const score = state.scores[input.dataset.match] || { home: "", away: "" };
  score[input.dataset.team] = value;
  state.scores[input.dataset.match] = score;
  saveState();

  const match = matches.find((item) => String(item.id) === input.dataset.match);
  const card = input.closest(".match-card");
  const outcome = outcomeFor(match);
  card.classList.toggle("completed", Boolean(outcome));
  card.querySelector(".team-side:not(.away)").classList.toggle("winner", outcome === "home");
  card.querySelector(".team-side.away").classList.toggle("winner", outcome === "away");
  card.querySelector(".outcome-label").textContent =
    outcome === "draw" ? "تعادل" : outcome ? "فوز" : "النتيجة";
  updateProgress();
});

submitButton.addEventListener("click", async () => {
  submitButton.disabled = true;
  submitLabel.textContent = "جاري حفظ التوقعات";
  try {
    const currentScores = Object.fromEntries(
      matches.map((match) => [matchKey(match), scoreFor(match)])
    );
    const response = await fetch("/api/predictions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        roundNumber: activeRound.number,
        scores: currentScores,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر حفظ التوقعات.");

    submitLabel.textContent = "جاري إنشاء الصورة";
    shareBlob = await createPredictionImage();
    shareImage.src = URL.createObjectURL(shareBlob);
    resultDialog.showModal();
  } catch (error) {
    showToast(error.message);
  } finally {
    submitLabel.textContent = "إرسال التوقعات";
    submitButton.disabled = false;
    updateProgress();
  }
});

closeDialog.addEventListener("click", () => resultDialog.close());
resultDialog.addEventListener("click", (event) => {
  if (event.target === resultDialog) resultDialog.close();
});

shareButton.addEventListener("click", async () => {
  if (!shareBlob) return;
  const file = new File([shareBlob], `توقعات-${currentUser.username}.png`, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: `توقعات كأس العالم - ${activeRound.name}`,
        files: [file],
      });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  downloadImage();
  showToast("تم تنزيل الصورة لمشاركتها");
});

downloadButton.addEventListener("click", downloadImage);

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/auth.html");
});

async function startApp() {
  const sessionResponse = await fetch("/api/auth/me", { cache: "no-store" });
  const { user } = await sessionResponse.json();
  if (!user) {
    window.location.replace("/auth.html");
    return;
  }
  if (user.role === "admin") {
    window.location.replace("/admin.html");
    return;
  }
  currentUser = user;
  state.scores = loadUserState();
  accountName.textContent = user.username;
  submitUsername.textContent = user.username;
  adminLink.hidden = true;

  const savedResponse = await fetch("/api/predictions", { cache: "no-store" });
  if (savedResponse.ok) {
    const savedData = await savedResponse.json();
    for (const prediction of savedData.predictions || []) {
      const scores =
        typeof prediction.scores === "string"
          ? JSON.parse(prediction.scores)
          : prediction.scores;
      state.scores = { ...state.scores, ...scores };
    }
    saveState();
  }
  renderLoading();
  updateProgress();
  await loadMatches();
}

startApp().catch(() => {
  window.location.replace("/auth.html");
});
