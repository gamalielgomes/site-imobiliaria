(function initializeSupabase() {
  const config = window.APP_CONFIG?.supabase;
  const createClient = window.supabase?.createClient;

  if (!config?.url || !config?.publishableKey || !createClient) {
    console.error("Não foi possível iniciar a conexão com o Supabase.");
    window.supabaseClient = null;
    return;
  }

  window.supabaseClient = createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
})();
