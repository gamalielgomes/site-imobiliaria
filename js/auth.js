(function authPage() {
  const client = window.supabaseClient;
  const form = document.querySelector("#login-form");
  const message = document.querySelector("#login-message");

  if (!form) return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!client) {
      message.textContent = "Não foi possível iniciar a conexão com o painel.";
      message.className = "form-message is-error";
      return;
    }
    const button = form.querySelector("button[type='submit']");
    const { email, password } = Object.fromEntries(new FormData(form).entries());
    button.disabled = true;
    button.textContent = "Entrando…";
    message.textContent = "";
    try {
      const { error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "admin.html";
    } catch (error) {
      console.error(error);
      message.textContent = "Não foi possível entrar. Confira seu e-mail e senha.";
      message.className = "form-message is-error";
      button.disabled = false;
      button.textContent = "Entrar no painel";
    }
  });
})();
