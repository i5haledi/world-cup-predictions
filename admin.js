const list = document.querySelector("#admin-list");
const statusMessage = document.querySelector("#status-message");

async function loadUsers() {
  const sessionResponse = await fetch("/api/auth/me", { cache: "no-store" });
  const { user } = await sessionResponse.json();
  if (!user) return window.location.replace("/auth.html");
  if (user.role !== "admin") return window.location.replace("/leaderboard.html");

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
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.replace("/auth.html");
});

loadUsers().catch(() => {
  list.innerHTML = '<div class="empty-state">تعذر الاتصال بالخادم.</div>';
});
