(function propertiesPage() {
  const client = window.supabaseClient;
  const { propertyCard, propertyFeatures, defaultPropertyImage, revealElements, renderError, escapeHtml, formatCurrency, whatsappHref } = window.Site || {};
  const page = document.body.dataset.page;

  const showConfigurationError = (container) => {
    renderError?.(container, "A conexão com o catálogo não está disponível no momento.");
  };

  const queryProperties = async (filters = {}, featuredOnly = false, maximum = 0) => {
    if (!client) throw new Error("Cliente Supabase indisponível.");

    let query = client
      .from("imoveis")
      .select("*")
      .eq("disponivel", true)
      .order("destaque", { ascending: false })
      .order("created_at", { ascending: false });

    if (featuredOnly) query = query.eq("destaque", true);
    if (filters.finalidade) query = query.eq("finalidade", filters.finalidade);
    if (filters.tipo) query = query.eq("tipo", filters.tipo);
    if (filters.cidade) query = query.eq("cidade", filters.cidade);
    if (filters.bairro) query = query.eq("bairro", filters.bairro);
    if (maximum) query = query.limit(maximum);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  };

  const loadNeighborhoodFilters = async () => {
    const selects = document.querySelectorAll("[data-neighborhood-filter]");
    if (!selects.length || !client) return;

    try {
      const { data, error } = await client
        .from("imoveis")
        .select("bairro")
        .eq("disponivel", true)
        .order("bairro", { ascending: true });

      if (error) throw error;

      const neighborhoods = [...new Set(
        (data || []).map(({ bairro }) => bairro?.trim()).filter(Boolean),
      )].sort((first, second) => first.localeCompare(second, "pt-BR"));

      selects.forEach((select) => {
        const selectedNeighborhood = select.value;
        select.querySelectorAll('option:not([value=""])').forEach((option) => option.remove());

        neighborhoods.forEach((neighborhood) => {
          const option = document.createElement("option");
          option.value = neighborhood;
          option.textContent = neighborhood;
          select.append(option);
        });

        if (selectedNeighborhood && !neighborhoods.includes(selectedNeighborhood)) {
          const option = document.createElement("option");
          option.value = selectedNeighborhood;
          option.textContent = selectedNeighborhood;
          select.append(option);
        }

        select.value = selectedNeighborhood;
      });
    } catch (error) {
      console.error("Não foi possível carregar os bairros.", error);
    }
  };

  const loadFeatured = async () => {
    const container = document.querySelector("#featured-properties");
    if (!container) return;
    if (!client) return showConfigurationError(container);

    try {
      const properties = await queryProperties({}, true, 3);
      container.innerHTML = properties.length
        ? properties.map(propertyCard).join("")
        : '<div class="empty-state"><h3>Novas oportunidades em breve.</h3><p>Fale com nossa equipe e conte o que você procura.</p></div>';
      revealElements?.(container);
    } catch (error) {
      console.error(error);
      renderError(container, "Tente atualizar a página em alguns instantes.");
    }
  };

  const loadHomeCollection = async ({ containerSelector, filters, emptyTitle, emptyMessage }) => {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    if (!client) return showConfigurationError(container);

    try {
      const properties = await queryProperties(filters, false, 3);
      container.innerHTML = properties.length
        ? properties.map(propertyCard).join("")
        : `<div class="empty-state"><h3>${emptyTitle}</h3><p>${emptyMessage}</p><a class="button button-outline" href="imoveis.html">Ver todos os imóveis</a></div>`;
      revealElements?.(container);
    } catch (error) {
      console.error(error);
      renderError(container, "Tente atualizar a página em alguns instantes.");
    }
  };

  const loadHomeCollections = () => Promise.all([
    loadHomeCollection({
      containerSelector: "#homes-for-sale",
      filters: { finalidade: "Venda", tipo: "Casa" },
      emptyTitle: "Casas à venda em breve.",
      emptyMessage: "Nossa equipe pode ajudar você a encontrar a casa ideal para comprar.",
    }),
    loadHomeCollection({
      containerSelector: "#homes-for-rent",
      filters: { finalidade: "Aluguel", tipo: "Casa" },
      emptyTitle: "Casas para aluguel em breve.",
      emptyMessage: "Fale com a nossa equipe e conte como deve ser o seu próximo lar.",
    }),
  ]);

  const readFiltersFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      finalidade: params.get("finalidade") || "",
      tipo: params.get("tipo") || "",
      cidade: params.get("cidade") || "",
      bairro: params.get("bairro") || "",
    };
  };

  const writeFiltersToUrl = (filters) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.toString();
    window.history.replaceState({}, "", `imoveis.html${query ? `?${query}` : ""}`);
  };

  const populateFilterForm = (filters) => {
    const form = document.querySelector("#listing-filters");
    if (!form) return;
    Object.entries(filters).forEach(([key, value]) => {
      if (form.elements[key]) form.elements[key].value = value;
    });
  };

  const loadListing = async (filters) => {
    const container = document.querySelector("#property-list");
    const count = document.querySelector("#property-count");
    if (!container) return;
    container.innerHTML = '<div class="loading-card"><span class="spinner" aria-hidden="true"></span><p>Buscando imóveis…</p></div>';
    if (!client) return showConfigurationError(container);

    try {
      const properties = await queryProperties(filters);
      count.textContent = properties.length === 1 ? "1 imóvel encontrado" : `${properties.length} imóveis encontrados`;
      container.innerHTML = properties.length
        ? properties.map(propertyCard).join("")
        : '<div class="empty-state"><h3>Nenhum imóvel encontrado.</h3><p>Ajuste os filtros ou fale com nossa equipe — podemos ajudar na busca.</p><a class="button button-outline" href="imoveis.html">Ver todos os imóveis</a></div>';
      revealElements?.(container);
    } catch (error) {
      console.error(error);
      count.textContent = "";
      renderError(container, "Tente atualizar a página em alguns instantes.");
    }
  };

  const renderDetail = (property) => {
    const uploadedImages = [...new Set([property.imagem_url, ...(property.imagens || [])].filter(Boolean))];
    const images = uploadedImages.length ? uploadedImages : [defaultPropertyImage];
    const location = [property.bairro, property.cidade].filter(Boolean).join(", ");
    const gallery = images.length
      ? images.map((image, index) => `<img src="${escapeHtml(image)}" alt="${escapeHtml(image === defaultPropertyImage ? "Imagem padrão do imóvel" : `${property.titulo} — imagem ${index + 1}`)}" ${index === 0 ? "" : 'loading="lazy"'} />`).join("")
      : '<div class="gallery-placeholder">Imagem indisponível</div>';

    return `
      <a class="back-link" href="imoveis.html">← Voltar aos imóveis</a>
      <div class="detail-gallery ${images.length === 1 ? "one-image" : ""}">${gallery}</div>
      <div class="detail-grid">
        <article class="detail-copy">
          <p class="eyebrow">${escapeHtml(property.finalidade)} · ${escapeHtml(property.tipo)}</p>
          <h1>${escapeHtml(property.titulo)}</h1>
          <p class="property-location detail-location">${escapeHtml(location || "Belo Jardim, PE")}</p>
          <p class="detail-price">${formatCurrency(property.preco, property.finalidade)}</p>
          ${propertyFeatures(property, "detail-features")}
          <div class="detail-description"><h2>Sobre este imóvel</h2><p>${escapeHtml(property.descricao || "Entre em contato para saber mais sobre esta oportunidade.").replaceAll("\n", "<br>")}</p></div>
        </article>
        <aside class="contact-card"><p class="eyebrow">Gostou deste imóvel?</p><h2>Receba todos os detalhes.</h2><p>Fale com nossa equipe para agendar uma visita ou tirar suas dúvidas.</p><a class="button button-primary button-full" href="${whatsappHref(property.titulo)}" target="_blank" rel="noopener">Tenho interesse</a><p class="property-code">Código do imóvel: ${escapeHtml(property.codigo)}</p></aside>
      </div>`;
  };

  const loadDetail = async () => {
    const container = document.querySelector("#property-detail");
    if (!container) return;
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) {
      container.innerHTML = '<div class="empty-state"><h1>Imóvel não encontrado.</h1><p>Escolha uma oportunidade da nossa lista.</p><a class="button button-primary" href="imoveis.html">Ver imóveis</a></div>';
      return;
    }
    if (!client) return showConfigurationError(container);
    try {
      const { data, error } = await client.from("imoveis").select("*").eq("id", id).single();
      if (error) throw error;
      document.title = `${data.titulo} | ${window.APP_CONFIG?.business?.name || "Aurora Imóveis"}`;
      container.innerHTML = renderDetail(data);
      revealElements?.(container);
    } catch (error) {
      console.error(error);
      container.innerHTML = '<div class="empty-state"><h1>Imóvel não encontrado.</h1><p>Ele pode não estar mais disponível.</p><a class="button button-primary" href="imoveis.html">Ver imóveis</a></div>';
    }
  };

  const setHomeSearch = () => {
    const form = document.querySelector("#property-search-form");
    form?.addEventListener("submit", (event) => {
      event.preventDefault();
      const formData = new FormData(form);
      const params = new URLSearchParams();
      ["finalidade", "tipo", "cidade", "bairro"].forEach((key) => {
        const value = formData.get(key);
        if (value) params.set(key, value);
      });
      window.location.href = `imoveis.html${params.size ? `?${params.toString()}` : ""}`;
    });
  };

  const setListingFilters = () => {
    const form = document.querySelector("#listing-filters");
    const clearButton = document.querySelector("#clear-filters");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const filters = Object.fromEntries(new FormData(form).entries());
      writeFiltersToUrl(filters);
      loadListing(filters);
    });
    clearButton?.addEventListener("click", () => {
      form.reset();
      writeFiltersToUrl({});
      loadListing({});
    });
  };

  const initializePage = async () => {
    if (page === "home") {
      setHomeSearch();
      loadNeighborhoodFilters();
      loadFeatured();
      loadHomeCollections();
    }
    if (page === "properties") {
      const filters = readFiltersFromUrl();
      await loadNeighborhoodFilters();
      populateFilterForm(filters);
      setListingFilters();
      loadListing(filters);
    }
    if (page === "property-detail") loadDetail();
  };

  initializePage();
})();
