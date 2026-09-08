(function siteUtilities() {
  const config = window.APP_CONFIG?.business;
  const defaultPropertyImage = "assets/imovel-padrao.svg";
  const supportsMotion = window.matchMedia
    && !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    && "IntersectionObserver" in window;
  const revealSelector = ".hero-content, .search-card, .section-heading, .property-card, .about-copy, .about-visual, .contact-band-content, .page-intro .container, .listing-filters, .detail-gallery, .detail-copy, .contact-card, .auth-card, .admin-panel, .admin-table-wrap, .footer-grid";
  let revealObserver;

  const revealElements = (root = document) => {
    if (!supportsMotion || !revealObserver) return;
    root.querySelectorAll(revealSelector).forEach((element, index) => {
      if (element.dataset.revealBound) return;
      element.dataset.revealBound = "true";
      element.dataset.reveal = "";
      element.style.setProperty("--reveal-delay", `${Math.min(index * 55, 220)}ms`);
      revealObserver.observe(element);
    });
  };

  const escapeHtml = (value = "") =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");

  const formatCurrency = (value, finalidade) => {
    const formatted = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(Number(value || 0));
    return finalidade === "Aluguel" ? `${formatted}/mês` : formatted;
  };

  const whatsappHref = (propertyTitle = "") => {
    const message = propertyTitle
      ? `Olá! Tenho interesse no imóvel: ${propertyTitle}.`
      : `Olá! Gostaria de encontrar um imóvel com a empresa ${config.name}.`;
    return `https://wa.me/${config.phoneDigits}?text=${encodeURIComponent(message)}`;
  };

  const featureIcons = {
    bedrooms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19V8.5" /><path d="M21 19V12" /><path d="M3 13h18" /><path d="M5 13V9.5A2.5 2.5 0 0 1 7.5 7h2A2.5 2.5 0 0 1 12 9.5V13" /><path d="M12 11h5.5A2.5 2.5 0 0 1 20 13.5V19" /></svg>',
    bathrooms: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h16" /><path d="M6 12V9a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v3" /><path d="M5 12v2a5 5 0 0 0 5 5h4a5 5 0 0 0 5-5v-2" /><path d="M7 19v2" /><path d="M17 19v2" /><path d="M18 7h.01" /></svg>',
    parking: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m5 16 1.5-5.2A2 2 0 0 1 8.4 9.4h7.2a2 2 0 0 1 1.9 1.4L19 16" /><path d="M4 16h16v3a1 1 0 0 1-1 1h-1v-2H6v2H5a1 1 0 0 1-1-1v-3Z" /><path d="M7 16h.01M17 16h.01" /></svg>',
    area: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 9V5h4" /><path d="M15 5h4v4" /><path d="M19 15v4h-4" /><path d="M9 19H5v-4" /><path d="M8 16 16 8" /><path d="M10 8h6v6" /></svg>',
  };

  const propertyFeatures = (property, className = "property-features") => {
    const features = [
      { icon: "bedrooms", label: "quartos", value: Number(property.quartos || 0) },
      { icon: "bathrooms", label: "banheiros", value: Number(property.banheiros || 0) },
      { icon: "parking", label: "vagas de garagem", value: Number(property.vagas || 0) },
      { icon: "area", label: "metros quadrados", value: Number(property.area_m2 || 0), suffix: "m²" },
    ];

    return `<ul class="${className}" aria-label="Características do imóvel">
      ${features.map((feature) => `
        <li class="property-feature" title="${escapeHtml(`${feature.value} ${feature.label}`)}">
          <span class="feature-visual" aria-hidden="true"><span class="feature-icon">${featureIcons[feature.icon]}</span><span class="feature-value">${feature.value}${feature.suffix ? ` ${feature.suffix}` : ""}</span></span>
          <span class="visually-hidden">${escapeHtml(`${feature.value} ${feature.label}`)}</span>
        </li>`).join("")}
    </ul>`;
  };

  const propertyCard = (property) => {
    const image = property.imagem_url || property.imagens?.[0] || defaultPropertyImage;
    const imageAlt = image === defaultPropertyImage ? "Imagem padrão do imóvel" : property.titulo;
    const location = [property.bairro, property.cidade].filter(Boolean).join(", ");
    return `
      <article class="property-card">
        <a class="property-image-link" href="imovel.html?id=${encodeURIComponent(property.id)}" aria-label="Ver ${escapeHtml(property.titulo)}">
          <img class="property-image" src="${escapeHtml(image)}" alt="${escapeHtml(imageAlt)}" loading="lazy" />
          <span class="property-tag">${escapeHtml(property.finalidade)}</span>
        </a>
        <div class="property-card-body">
          <p class="property-location">${escapeHtml(location || "Belo Jardim, PE")}</p>
          <h3><a href="imovel.html?id=${encodeURIComponent(property.id)}">${escapeHtml(property.titulo)}</a></h3>
          <p class="property-price">${formatCurrency(property.preco, property.finalidade)}</p>
          ${propertyFeatures(property)}
        </div>
      </article>`;
  };

  const renderError = (container, message) => {
    container.innerHTML = `<div class="empty-state"><h3>Não foi possível carregar os imóveis.</h3><p>${escapeHtml(message)}</p><a class="button button-outline" href="imoveis.html">Tentar novamente</a></div>`;
  };

  window.Site = { escapeHtml, formatCurrency, whatsappHref, propertyCard, propertyFeatures, defaultPropertyImage, revealElements, renderError };

  if (supportsMotion) {
    revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        revealObserver.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -36px" });
    revealElements();
    document.body.classList.add("motion-enabled");
  }

  document.querySelectorAll("[data-current-year]").forEach((element) => {
    element.textContent = new Date().getFullYear();
  });
  document.querySelectorAll("[data-whatsapp-link]").forEach((element) => {
    element.href = whatsappHref();
  });
  document.querySelectorAll("[data-email-link]").forEach((element) => {
    element.href = `mailto:${config.email}`;
  });
  document.querySelectorAll("[data-phone-link]").forEach((element) => {
    element.href = `tel:+${config.phoneDigits}`;
  });
  document.querySelectorAll("[data-phone-display]").forEach((element) => {
    element.textContent = config.phoneDisplay;
  });
  document.querySelectorAll("[data-email-display]").forEach((element) => {
    element.textContent = config.email;
  });
  document.querySelectorAll("[data-address]").forEach((element) => {
    element.textContent = config.address;
  });
  document.querySelectorAll("[data-creci]").forEach((element) => {
    element.textContent = config.creci;
  });

  const toggle = document.querySelector("[data-nav-toggle]");
  const navigation = document.querySelector("[data-nav]");
  toggle?.addEventListener("click", () => {
    const isOpen = navigation.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
  });

  document.querySelectorAll("[data-nav] a").forEach((link) => {
    link.addEventListener("click", () => {
      navigation?.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    });
  });

  document.querySelectorAll("[data-carousel-control]").forEach((control) => {
    control.addEventListener("click", () => {
      const carousel = document.querySelector(control.dataset.carouselTarget);
      if (!carousel) return;
      const direction = control.dataset.carouselControl === "previous" ? -1 : 1;
      const amount = Math.max(carousel.clientWidth * 0.82, 300);
      carousel.scrollBy({ left: amount * direction, behavior: "smooth" });
    });
  });
})();
