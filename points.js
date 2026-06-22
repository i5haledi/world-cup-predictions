let pointsData = null;
let selectedRound = null;

const filters = document.querySelector("#round-filters");
const body = document.querySelector("#points-body");
const totalPoints = document.querySelector("#total-points");
const pointsUsername = document.querySelector("#points-username");
const adminLink = document.querySelector("#admin-link");

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
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

function scorePair(score) {
  if (!score) return '<strong class="points-score-empty">لا يوجد</strong>';
  return `
    <strong class="points-score-pair" aria-label="${escapeHtml(score.home)} - ${escapeHtml(score.away)}">
      <b>${escapeHtml(score.home)}</b>
      <span>-</span>
      <b>${escapeHtml(score.away)}</b>
    </strong>
  `;
}

function statusCopy(match) {
  if (match.status === "scored" && match.points === 3) return "نتيجة صحيحة";
  if (match.status === "scored" && match.points === 1) return "توقع صحيح";
  if (match.status === "scored") return "لم تكسب نقاط";
  if (match.status === "missed") return "لم تتوقع";
  if (match.status === "pending_result") return "بانتظار النتيجة";
  if (match.status === "saved") return "محفوظ";
  return "لم يتوقع";
}

function renderFilters() {
  filters.innerHTML = pointsData.rounds.map((round) => `
    <button
      class="round-filter ${Number(round.number) === Number(selectedRound) ? "active" : ""}"
      type="button"
      data-round="${round.number}"
    >
      <span>${escapeHtml(round.name)}</span>
      <strong>${round.totalPoints}</strong>
    </button>
  `).join("");
}

function renderRound() {
  const round = pointsData.rounds.find((item) => Number(item.number) === Number(selectedRound));
  if (!round) {
    body.innerHTML = '<div class="empty-state">لا توجد تفاصيل لهذه الجولة.</div>';
    return;
  }

  const manualNote = round.number === 1 && round.manualPoints !== null
    ? `<div class="manual-round-note">نقاط هذه الجولة أضيفت يدوياً لأنها سبقت نظام التفاصيل الحالي.</div>`
    : "";

  body.innerHTML = `
    <article class="round-points-card panel">
      <header class="round-points-head">
        <div>
          <span>${escapeHtml(round.name)}</span>
          <strong>${round.totalPoints} نقطة</strong>
        </div>
        <small>${round.matches.length} مباراة</small>
      </header>
      ${manualNote}
      <div class="points-match-list">
        ${round.matches.map((match) => `
          <div class="points-match-card ${escapeHtml(match.status)}">
            <div class="points-team-side">
              <span class="points-flag-frame">
                <img class="points-flag" src="${escapeHtml(match.homeFlag)}" alt="علم ${escapeHtml(match.home)}" />
              </span>
              <span class="points-team-name">${escapeHtml(match.home)}</span>
            </div>
            <div class="points-match-center">
              <span class="points-kickoff">${formatKickoff(match.kickoff)}</span>
              <div class="points-score-rows">
                <div class="points-score-row">
                  <span>توقعك</span>
                  ${scorePair(match.predicted)}
                </div>
                <div class="points-score-row">
                  <span>النتيجة</span>
                  ${scorePair(match.actual)}
                </div>
              </div>
              <div class="points-earned">
                <span>${statusCopy(match)}</span>
                <strong>${match.points}</strong>
              </div>
            </div>
            <div class="points-team-side away">
              <span class="points-flag-frame">
                <img class="points-flag" src="${escapeHtml(match.awayFlag)}" alt="علم ${escapeHtml(match.away)}" />
              </span>
              <span class="points-team-name">${escapeHtml(match.away)}</span>
            </div>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

async function loadPage() {
  const [sessionResponse, pointsResponse] = await Promise.all([
    fetch("/api/auth/me", { cache: "no-store" }),
    fetch("/api/points", { cache: "no-store" }),
  ]);
  const session = await sessionResponse.json();
  if (!session.user) {
    window.location.replace("/auth.html");
    return;
  }
  if (session.user.role === "admin") {
    window.location.replace("/admin.html");
    return;
  }
  adminLink.hidden = session.user.role !== "admin";

  pointsData = await pointsResponse.json();
  if (!pointsResponse.ok) {
    body.innerHTML = `<div class="empty-state">${pointsData.error || "تعذر تحميل تفاصيل النقاط."}</div>`;
    return;
  }
  pointsUsername.textContent = pointsData.user.username;
  totalPoints.textContent = pointsData.totalPoints;

  if (!pointsData.rounds.length) {
    filters.innerHTML = "";
    body.innerHTML = '<div class="empty-state">لا توجد نقاط أو توقعات محفوظة حتى الآن.</div>';
    return;
  }

  selectedRound = pointsData.rounds.at(-1).number;
  renderFilters();
  renderRound();
}

filters.addEventListener("click", (event) => {
  const button = event.target.closest(".round-filter");
  if (!button) return;
  selectedRound = Number(button.dataset.round);
  renderFilters();
  renderRound();
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/auth.html");
});

loadPage().catch(() => {
  body.innerHTML = '<div class="empty-state">تعذر الاتصال بالخادم.</div>';
});
