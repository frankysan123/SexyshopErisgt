// Numero que recibira los pedidos por WhatsApp.
const WHATSAPP_NUMBER = "50254894131";
    // Elementos principales que JavaScript necesita controlar.

    const mobileToggle = document.querySelector("#mobileToggle");
    const navLinks = document.querySelector("#navLinks");
    const searchInput = document.querySelector("#searchInput");
    const chips = document.querySelectorAll(".chip");
    const cards = document.querySelectorAll("[data-category]");
    const cartButton = document.querySelector("#cartButton");
    const orderDrawer = document.querySelector("#orderDrawer");
    const closeDrawer = document.querySelector("#closeDrawer");
    const drawerItems = document.querySelector("#drawerItems");
    const whatsappLink = document.querySelector("#whatsappLink");
    const imageViewer = document.querySelector("#imageViewer");
    const expandedProductImage = document.querySelector("#expandedProductImage");
    const closeImageViewer = document.querySelector("#closeImageViewer");
    const productImages = document.querySelectorAll(".product-card .product-media img");
    const order = [];
    let activeFilter = "all";
    const heroSlides = document.querySelectorAll(".hero-slide");
    const productCarousels = document.querySelectorAll(".product-carousel");
    let currentSlide = 0;

    // Cambia automaticamente la imagen principal cada 4.5 segundos.
    if (heroSlides.length > 1) {
      setInterval(() => {
        heroSlides[currentSlide].classList.remove("active");
        currentSlide = (currentSlide + 1) % heroSlides.length;
        heroSlides[currentSlide].classList.add("active");
      }, 4500);
    }

    // Inicializa cada carrusel para que sus flechas funcionen de forma independiente.
    productCarousels.forEach((carousel) => {
      const track = carousel.querySelector(".product-carousel-track");
      const arrows = carousel.querySelectorAll("[data-carousel-direction]");

      function updateArrows() {
        const maxScroll = track.scrollWidth - track.clientWidth;
        arrows.forEach((arrow) => {
          const atStart = track.scrollLeft <= 2;
          const atEnd = track.scrollLeft >= maxScroll - 2;
          arrow.disabled = arrow.dataset.carouselDirection === "prev" ? atStart : atEnd;
        });
      }

      arrows.forEach((arrow) => {
        arrow.addEventListener("click", () => {
          const direction = arrow.dataset.carouselDirection === "next" ? 1 : -1;
          track.scrollBy({
            left: direction * track.clientWidth,
            behavior: "smooth",
          });
        });
      });

      track.addEventListener("scroll", updateArrows, { passive: true });
      track.addEventListener("keydown", (event) => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        const direction = event.key === "ArrowRight" ? 1 : -1;
        track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
      });
      window.addEventListener("resize", updateArrows);
      requestAnimationFrame(updateArrows);
    });


    // Abre las fotografias de productos en una ventana ampliada.
    function openImageViewer(image) {
      expandedProductImage.src = image.currentSrc || image.src;
      expandedProductImage.alt = image.alt || "Imagen ampliada del producto";
      imageViewer.showModal();
    }

    productImages.forEach((image) => {
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `Ampliar ${image.alt || "imagen del producto"}`);
      image.addEventListener("click", () => openImageViewer(image));
      image.addEventListener("keydown", (event) => {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        openImageViewer(image);
      });
    });

    closeImageViewer.addEventListener("click", () => imageViewer.close());
    imageViewer.addEventListener("click", (event) => {
      if (event.target === imageViewer) imageViewer.close();
    });
    imageViewer.addEventListener("close", () => {
      expandedProductImage.removeAttribute("src");
      expandedProductImage.alt = "";
    });
    // Abre y cierra el menu en telefonos.
    mobileToggle.addEventListener("click", () => navLinks.classList.toggle("open"));
    navLinks.addEventListener("click", (event) => {
      if (event.target.tagName === "A") navLinks.classList.remove("open");
    });

    // Activa el filtro seleccionado y actualiza las tarjetas.
    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        chips.forEach((item) => item.classList.remove("active"));
        chip.classList.add("active");
        activeFilter = chip.dataset.filter;
        applyFilters();
      });
    });

    searchInput.addEventListener("input", applyFilters);

    // Muestra solo los productos que coinciden con filtro y busqueda.
    function applyFilters() {
      const query = searchInput.value.trim().toLowerCase();
      cards.forEach((card) => {
        const categoryMatch = activeFilter === "all" || card.dataset.category === activeFilter;
        const text = `${card.dataset.name || ""} ${card.textContent}`.toLowerCase();
        const queryMatch = !query || text.includes(query);
        card.classList.toggle("hidden", !(categoryMatch && queryMatch));
      });
      window.dispatchEvent(new Event("resize"));
    }

    // Agrega o quita productos del pedido.
    document.addEventListener("click", (event) => {
      const removeButton = event.target.closest("[data-remove]");
      if (removeButton) {
        order.splice(Number(removeButton.dataset.remove), 1);
        renderOrder();
        return;
      }

      const addButton = event.target.closest("[data-add]");
      if (!addButton) return;
      order.push(addButton.dataset.add);
      renderOrder();
      orderDrawer.classList.add("open");
    });

    cartButton.addEventListener("click", () => orderDrawer.classList.add("open"));
    closeDrawer.addEventListener("click", () => orderDrawer.classList.remove("open"));

    // Construye el resumen y el mensaje listo para WhatsApp.
    function renderOrder() {
      cartButton.textContent = order.length;
      if (!order.length) {
        drawerItems.innerHTML = '<p class="section-desc">Agrega productos para preparar tu mensaje.</p>';
        whatsappLink.href = "#";
        return;
      }

      drawerItems.innerHTML = order.map((item, index) => `
        <div class="drawer-item">
          <strong>${index + 1}.</strong>
          <span>${item}</span>
          <button
            class="remove-item"
            type="button"
            data-remove="${index}"
            aria-label="Quitar ${item}"
            title="Quitar producto"
          >×</button>
        </div>
      `).join("");
      const message = `Hola, quiero consultar disponibilidad de:%0A${order.map((item) => `- ${item}`).join("%0A")}`;
      whatsappLink.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    }











