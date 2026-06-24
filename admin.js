const list = document.querySelector("#admin-list");
const predictionsPanel = document.querySelector("#admin-predictions");
const statusMessage = document.querySelector("#status-message");

function formatKickoff(value) {
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDateTime(value) {
  if (!value) return "غير متوفر";
  return new Intl.DateTimeFormat("ar-SA", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

async function loadAdminPage() {
  const sessionResponse = await fetch("/api/auth/me", { cache: "no-store" });
  const { user } = await sessionResponse.json();
  if (!user) return window.location.replace("/auth.html");
  if (user.role !== "admin") return window.location.replace("/leaderboard.html");

  await Promise.all([loadUsers(), loadPredictions()]);
}

async function loadUsers() {
  const response = await fetch("/api/admin/users", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    list.innerHTML = `<div class="empty-state">${data.error}</div>`;
    return;
  }
  list.innerHTML = data.users.map((item) => `
    <article class="admin-user">
      <div>
        <strong>${escapeHtml(item.username)}</strong>
        <small>${item.role === "admin" ? "آدمن" : "مستخدم"}</small>
        <small class="admin-total-points">المجموع الحالي: ${Number(item.total_points || 0)} نقطة</small>
        <small>${formatRounds(item.rounds)}</small>
      </div>
      <input
        class="score-field"
        type="number"
        min="0"
        max="1000"
        value="${item.round_one_points}"
        aria-label="نقاط ${escapeHtml(item.username)}"
      />
      <button class="save-button" type="button" data-user-id="${item.id}">حفظ</button>
    </article>
  `).join("");
}

function formatRounds(rounds = {}) {
  const entries = Object.entries(rounds).sort(([a], [b]) => Number(a) - Number(b));
  if (!entries.length) return "لا توجد نقاط بعد";
  return entries.map(([round, points]) => `ج${round}: ${Number(points)}`).join(" | ");
}

async function loadPredictions() {
  const response = await fetch("/api/admin/predictions", { cache: "no-store" });
  const data = await response.json();
  if (!response.ok) {
    predictionsPanel.innerHTML = `<div class="empty-state">${data.error}</div>`;
    return;
  }

  if (!data.rounds?.length || !data.users?.length) {
    predictionsPanel.innerHTML = '<div class="empty-state">لا توجد توقعات محفوظة حتى الآن.</div>';
    return;
  }

  const matches = data.rounds.flatMap((round) =>
    round.matches.map((match) => ({ ...match, roundName: round.name }))
  );
  predictionsPanel.innerHTML = data.users.map((player) => {
    const completed = matches.filter((match) => player.predictions?.[match.id]).length;
    return `
      <article class="admin-prediction-card">
        <header class="prediction-user-head">
          <div>
            <strong>${escapeHtml(player.username)}</strong>
            <small>${completed} / ${matches.length} مباراة محفوظة</small>
          </div>
        </header>
        <div class="prediction-match-list">
          ${matches.map((match) => {
            const prediction = player.predictions?.[match.id];
            return `
              <div class="prediction-match-row ${prediction ? "saved" : "missing"}">
                <div>
                  <span class="prediction-round">${escapeHtml(match.roundName)} - ${formatKickoff(match.kickoff)}</span>
                  <strong>${escapeHtml(match.home)} × ${escapeHtml(match.away)}</strong>
                </div>
                ${prediction ? `
                  <span class="prediction-score prediction-score-detail">
                    <span>${escapeHtml(match.home)}: <strong dir="ltr">${escapeHtml(prediction.home)}</strong></span>
                    <span>${escapeHtml(match.away)}: <strong dir="ltr">${escapeHtml(prediction.away)}</strong></span>
                    <small>أضيف: ${formatDateTime(prediction.createdAt)}</small>
                    <small>آخر تحديث: ${formatDateTime(prediction.updatedAt)}</small>
                    ${prediction.events?.length ? `
                      <small class="prediction-history">
                        ${prediction.events.map((item) => `${item.action === "create" ? "إضافة" : "تحديث"} ${formatDateTime(item.createdAt)} (${escapeHtml(item.home)}-${escapeHtml(item.away)})`).join(" · ")}
                      </small>
                    ` : ""}
                  </span>
                ` : '<span class="prediction-score">لم يتوقع</span>'}
              </div>
            `;
          }).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

list.addEventListener("click", async (event) => {
  const button = event.target.closest(".save-button");
  if (!button) return;
  const input = button.closest(".admin-user").querySelector(".score-field");
  button.disabled = true;

  const response = await fetch("/api/admin/score", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: button.dataset.userId,
      roundNumber: 1,
      points: Number(input.value),
    }),
  });
  const data = await response.json();
  statusMessage.textContent = response.ok ? "تم حفظ النقاط." : data.error;
  button.disabled = false;
  if (response.ok) loadUsers();
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/auth.html");
});

loadAdminPage().catch(() => {
  list.innerHTML = '<div class="empty-state">تعذر الاتصال بالخادم.</div>';
  predictionsPanel.innerHTML = '<div class="empty-state">تعذر الاتصال بالخادم.</div>';
});
