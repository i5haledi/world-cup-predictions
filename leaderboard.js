let currentUser = null;

async function loadPage() {
  const [sessionResponse, boardResponse] = await Promise.all([
    fetch("/api/auth/me", { cache: "no-store" }),
    fetch("/api/leaderboard", { cache: "no-store" }),
  ]);
  const session = await sessionResponse.json();
  if (!session.user) {
    window.location.replace("/auth.html");
    return;
  }
  currentUser = session.user;
  document.querySelector("#admin-link").hidden = currentUser.role !== "admin";

  const data = await boardResponse.json();
  const body = document.querySelector("#leaderboard-body");
  if (!boardResponse.ok) {
    body.className = "empty-state";
    body.textContent = data.error || "تعذر تحميل الترتيب.";
    return;
  }
  if (!data.leaderboard.length) {
    body.className = "empty-state";
    body.textContent = "لا يوجد مستخدمون بعد.";
    return;
  }

  body.className = "";
  body.innerHTML = data.leaderboard.map((player) => {
    const rounds = Object.entries(player.rounds)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([round, points]) => `<span>ج${round}: ${points}</span>`)
      .join("");
    return `
      <div class="leader-row ${String(player.id) === String(currentUser.id) ? "me" : ""}">
        <span class="rank">${player.rank}</span>
        <div>
          <span class="player-name">${escapeHtml(player.username)}</span>
          <div class="round-breakdown">${rounds || "<span>لا توجد نقاط بعد</span>"}</div>
        </div>
        <span class="points">${player.points}</span>
      </div>
    `;
  }).join("");
}

function escapeHtml(value) {
  const element = document.createElement("span");
  element.textContent = value;
  return element.innerHTML;
}

document.querySelector("#logout-button").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/auth.html");
});

loadPage().catch(() => {
  document.querySelector("#leaderboard-body").textContent = "تعذر الاتصال بالخادم.";
});
