const form = document.querySelector("#auth-form");
const tabs = document.querySelectorAll(".auth-tab");
const submitButton = document.querySelector("#auth-submit");
const message = document.querySelector("#auth-message");
const password = document.querySelector("#password");
let mode = "login";

fetch("/api/auth/me", { cache: "no-store" })
  .then((response) => response.json())
  .then(({ user }) => {
    if (user) window.location.replace("/");
  })
  .catch(() => {});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    mode = tab.dataset.mode;
    tabs.forEach((item) => item.classList.toggle("active", item === tab));
    submitButton.textContent = mode === "login" ? "دخول" : "إنشاء الحساب";
    password.autocomplete = mode === "login" ? "current-password" : "new-password";
    message.textContent = "";
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  submitButton.disabled = true;
  message.textContent = "";

  try {
    const response = await fetch(`/api/auth/${mode}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.username.value,
        password: form.password.value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "تعذر إكمال العملية.");
    window.location.replace("/");
  } catch (error) {
    message.textContent = error.message;
    submitButton.disabled = false;
  }
});
