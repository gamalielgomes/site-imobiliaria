(function adminPage() {
  const STORAGE_BUCKET = "imoveis";
  const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
  const MAX_IMAGES_PER_PROPERTY = 9;
  const IMAGE_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  const client = window.supabaseClient;
  const status = document.querySelector("#admin-status");
  const content = document.querySelector("#admin-content");
  const emptyState = document.querySelector("#admin-empty");
  const list = document.querySelector("#admin-property-list");
  const panel = document.querySelector("#property-form-panel");
  const form = document.querySelector("#property-form");
  const userLabel = document.querySelector("#admin-user");
  const imageUploadHint = document.querySelector("#image-upload-hint");
  let properties = [];
  let editingProperty = null;

  const setStatus = (text = "", type = "") => {
    status.textContent = text;
    status.className = `form-message${type ? ` is-${type}` : ""}`;
  };

  const escapeHtml = window.Site?.escapeHtml || ((value) => value);
  const formatCurrency = window.Site?.formatCurrency || ((value) => value);
  const existingImages = (property) => [property?.imagem_url, ...(Array.isArray(property?.imagens) ? property.imagens : [])].filter(Boolean);

  const updateImageHint = (property) => {
    if (!imageUploadHint) return;
    const count = existingImages(property).length;
    imageUploadHint.textContent = count
      ? `Este imóvel já possui ${count} foto${count === 1 ? "" : "s"}. Novos arquivos serão adicionados ao salvar.`
      : "As imagens são enviadas para o Storage da imobiliária ao salvar o imóvel.";
  };

  const showForm = (property = null) => {
    editingProperty = property;
    form.reset();
    form.elements.id.value = "";
    form.elements.cidade.value = "Belo Jardim";
    form.elements.disponivel.checked = true;
    document.querySelector("#property-form-title").textContent = property ? "Editar imóvel" : "Novo imóvel";
    if (property) {
      ["id", "codigo", "titulo", "finalidade", "tipo", "cidade", "bairro", "preco", "area_m2", "quartos", "banheiros", "vagas", "descricao"].forEach((key) => {
        form.elements[key].value = property[key] ?? "";
      });
      form.elements.destaque.checked = Boolean(property.destaque);
      form.elements.disponivel.checked = Boolean(property.disponivel);
    }
    updateImageHint(property);
    panel.hidden = false;
    panel.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.codigo.focus();
  };

  const closeForm = () => {
    panel.hidden = true;
    editingProperty = null;
    form.reset();
    updateImageHint(null);
  };

  const renderProperties = () => {
    content.hidden = properties.length === 0;
    emptyState.hidden = properties.length !== 0;
    list.innerHTML = properties.map((property) => `
      <tr>
        <td><strong>${escapeHtml(property.titulo)}</strong><small>${escapeHtml(property.codigo)} · ${escapeHtml(property.tipo)}</small></td>
        <td>${escapeHtml(property.finalidade)}</td>
        <td>${escapeHtml([property.bairro, property.cidade].filter(Boolean).join(", "))}</td>
        <td>${formatCurrency(property.preco, property.finalidade)}</td>
        <td><span class="status-pill ${property.disponivel ? "is-available" : "is-hidden"}">${property.disponivel ? "Disponível" : "Oculto"}</span></td>
        <td class="table-actions"><button type="button" class="table-button" data-edit-id="${property.id}">Editar</button><button type="button" class="table-button table-button-danger" data-delete-id="${property.id}">Excluir</button></td>
      </tr>`).join("");
  };

  const loadProperties = async () => {
    const { data, error } = await client.from("imoveis").select("*").order("created_at", { ascending: false });
    if (error) throw error;
    properties = data || [];
    renderProperties();
  };

  const getPropertyId = (id) => {
    if (id) return id;
    if (!window.crypto?.randomUUID) throw new Error("Seu navegador não consegue preparar o envio seguro de imagens. Atualize-o e tente novamente.");
    return window.crypto.randomUUID();
  };

  const validateImageFiles = (files) => {
    if (files.length > MAX_IMAGES_PER_PROPERTY) throw new Error(`Selecione no máximo ${MAX_IMAGES_PER_PROPERTY} fotos por imóvel.`);
    files.forEach((file) => {
      if (!IMAGE_EXTENSIONS[file.type]) throw new Error("Use somente imagens JPG, PNG ou WEBP.");
      if (file.size > MAX_IMAGE_SIZE) throw new Error("Cada imagem pode ter no máximo 5 MB.");
    });
  };

  const buildStoragePath = (propertyId, file) => `propriedades/${propertyId}/${window.crypto.randomUUID()}.${IMAGE_EXTENSIONS[file.type]}`;

  const uploadImage = async (file, propertyId) => {
    const path = buildStoragePath(propertyId, file);
    const { error } = await client.storage.from(STORAGE_BUCKET).upload(path, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    if (error) throw error;
    const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
    if (!data?.publicUrl) throw new Error("Não foi possível gerar o endereço da imagem.");
    return { path, url: data.publicUrl };
  };

  const removeStorageFiles = async (paths) => {
    if (!paths.length) return;
    const { error } = await client.storage.from(STORAGE_BUCKET).remove(paths);
    if (error) throw error;
  };

  const uploadImages = async (files, propertyId) => {
    validateImageFiles(files);
    const uploads = [];
    try {
      for (const file of files) uploads.push(await uploadImage(file, propertyId));
      return uploads;
    } catch (error) {
      try {
        await removeStorageFiles(uploads.map((upload) => upload.path));
      } catch (cleanupError) {
        console.error(cleanupError);
      }
      throw error;
    }
  };

  const storagePathFromUrl = (imageUrl) => {
    try {
      const url = new URL(imageUrl);
      const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
      const index = url.pathname.indexOf(marker);
      return index === -1 ? null : decodeURIComponent(url.pathname.slice(index + marker.length));
    } catch {
      return null;
    }
  };

  const storagePathsForProperty = (property) => [...new Set(existingImages(property).map(storagePathFromUrl).filter(Boolean))];

  const getPayload = async (propertyId) => {
    const values = Object.fromEntries(new FormData(form).entries());
    const mainImage = form.elements.foto_principal.files[0];
    const additionalImages = Array.from(form.elements.fotos_adicionais.files);
    const uploads = await uploadImages([mainImage, ...additionalImages].filter(Boolean), propertyId);
    let uploadIndex = 0;
    let imageUrl = editingProperty?.imagem_url || null;

    if (mainImage) imageUrl = uploads[uploadIndex++].url;
    else if (!imageUrl && uploads.length) imageUrl = uploads[uploadIndex++].url;

    const images = [...new Set([
      ...(Array.isArray(editingProperty?.imagens) ? editingProperty.imagens : []),
      ...uploads.slice(uploadIndex).map((upload) => upload.url),
    ])].filter((url) => url && url !== imageUrl);

    return {
      payload: {
        codigo: values.codigo.trim(),
        titulo: values.titulo.trim(),
        finalidade: values.finalidade,
        tipo: values.tipo,
        cidade: values.cidade.trim(),
        bairro: values.bairro.trim() || null,
        preco: Number(values.preco),
        area_m2: Number(values.area_m2),
        quartos: Number(values.quartos),
        banheiros: Number(values.banheiros),
        vagas: Number(values.vagas),
        imagem_url: imageUrl,
        imagens: images,
        descricao: values.descricao.trim() || null,
        destaque: form.elements.destaque.checked,
        disponivel: form.elements.disponivel.checked,
        updated_at: new Date().toISOString(),
      },
      uploadedPaths: uploads.map((upload) => upload.path),
    };
  };

  const saveProperty = async (event) => {
    event.preventDefault();
    const button = form.querySelector("button[type='submit']");
    button.disabled = true;
    setStatus();
    const id = form.elements.id.value;
    let uploadedPaths = [];

    try {
      const propertyId = getPropertyId(id);
      button.textContent = "Enviando fotos…";
      const { payload, uploadedPaths: paths } = await getPayload(propertyId);
      uploadedPaths = paths;
      button.textContent = "Salvando imóvel…";
      const request = id
        ? client.from("imoveis").update(payload).eq("id", id)
        : client.from("imoveis").insert({ ...payload, id: propertyId });
      const { error } = await request;
      if (error) throw error;
      closeForm();
      await loadProperties();
      setStatus(id ? "Imóvel e fotos atualizados com sucesso." : "Imóvel cadastrado com sucesso.", "success");
    } catch (error) {
      console.error(error);
      try {
        await removeStorageFiles(uploadedPaths);
      } catch (cleanupError) {
        console.error(cleanupError);
      }
      setStatus(error?.message || "Não foi possível salvar. Confirme os dados e suas permissões de administrador.", "error");
    } finally {
      button.disabled = false;
      button.textContent = "Salvar imóvel";
    }
  };

  const deleteProperty = async (id) => {
    const property = properties.find((item) => item.id === id);
    if (!property || !window.confirm(`Excluir “${property.titulo}”? Essa ação não pode ser desfeita.`)) return;
    setStatus();
    try {
      const { error } = await client.from("imoveis").delete().eq("id", id);
      if (error) throw error;
      try {
        await removeStorageFiles(storagePathsForProperty(property));
      } catch (storageError) {
        console.error(storageError);
        await loadProperties();
        setStatus("Imóvel excluído. Algumas fotos não puderam ser removidas automaticamente.", "success");
        return;
      }
      await loadProperties();
      setStatus("Imóvel e fotos excluídos com sucesso.", "success");
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível excluir o imóvel.", "error");
    }
  };

  const initialize = async () => {
    if (!client) {
      setStatus("Não foi possível iniciar a conexão com o painel.", "error");
      return;
    }
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      window.location.replace("login.html");
      return;
    }
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user || user.app_metadata?.role !== "admin") {
      setStatus("Esta conta não tem permissão de administrador. Peça para adicionarem role: admin aos metadados da conta.", "error");
      userLabel.textContent = user?.email || "";
      return;
    }
    userLabel.textContent = `Conectado como ${user.email}`;
    try {
      await loadProperties();
    } catch (error) {
      console.error(error);
      setStatus("Não foi possível carregar os imóveis. Verifique suas permissões de administrador.", "error");
    }
  };

  document.querySelector("#new-property-button")?.addEventListener("click", () => showForm());
  document.querySelector("#close-property-form")?.addEventListener("click", closeForm);
  document.querySelector("#cancel-property-form")?.addEventListener("click", closeForm);
  form?.addEventListener("submit", saveProperty);
  list?.addEventListener("click", (event) => {
    const editId = event.target.dataset.editId;
    const deleteId = event.target.dataset.deleteId;
    if (editId) showForm(properties.find((property) => property.id === editId));
    if (deleteId) deleteProperty(deleteId);
  });
  document.querySelector("#logout-button")?.addEventListener("click", async () => {
    await client?.auth.signOut();
    window.location.replace("login.html");
  });

  initialize();
})();
