const body = document.body;
const siteRoot = body.dataset.siteRoot || "./";

const menuButton = document.querySelector("[data-menu-button]");
const menu = document.querySelector("[data-menu]");

if (menuButton && menu) {
  menuButton.addEventListener("click", () => {
    const isOpen = menuButton.getAttribute("aria-expanded") === "true";
    menuButton.setAttribute("aria-expanded", String(!isOpen));
    menu.toggleAttribute("data-open", !isOpen);
  });

  menu.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      menuButton.setAttribute("aria-expanded", "false");
      menu.removeAttribute("data-open");
    }
  });
}

const workLists = document.querySelectorAll("[data-works-list]");
const workPager = document.querySelector(".work-pager");
let worksPromise;

if (workLists.length > 0) {
  loadWorks();
}

if (workPager) {
  setupWorkPager();
}

function getWorks() {
  if (!worksPromise) {
    worksPromise = fetch(`${siteRoot}data/works.json`).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load works: ${response.status}`);
      }

      return response.json();
    });
  }

  return worksPromise;
}

async function loadWorks() {
  try {
    const works = await getWorks();

    workLists.forEach((list) => {
      const mode = list.dataset.worksList;
      const visibleWorks =
        mode === "featured"
          ? works
              .filter((work) => Number.isInteger(work.featuredOrder))
              .sort((a, b) => a.featuredOrder - b.featuredOrder)
          : works;

      list.replaceChildren(...visibleWorks.map(createWorkCard));
    });

    setupCategoryFilter();
  } catch (error) {
    console.error(error);

    workLists.forEach((list) => {
      list.innerHTML =
        '<p class="notice">作品一覧を読み込めませんでした。時間を置いて、もう一度お試しください。</p>';
    });
  }
}

function createWorkCard(work) {
  const article = document.createElement("article");
  article.className = `work-card work-card--${work.slug}`;
  article.dataset.category = work.category;

  const detailHref = `${siteRoot}${encodeURI(work.detailPath)}`;

  const tags = work.tags
    .map((tag) => `<li class="tag">#${escapeHtml(tag)}</li>`)
    .join("");

  article.innerHTML = `
    <a class="work-card__link" href="${detailHref}" data-base-href="${detailHref}">
      <img class="work-card__image" src="${siteRoot}${encodeURI(work.thumbnailPath)}" alt="${escapeHtml(work.thumbnailAlt)}" loading="lazy">
      <div class="work-card__body">
        <p class="work-card__category">${escapeHtml(work.category)}</p>
        <h3 class="work-card__title">${escapeHtml(work.title)}</h3>
        <p class="work-card__summary">${escapeHtml(work.summary)}</p>
        <ul class="tag-list" aria-label="タグ">${tags}</ul>
        <span class="text-link">作品を見る <span aria-hidden="true">→</span></span>
      </div>
    </a>
  `;

  return article;
}

function setupCategoryFilter() {
  const filterButtons = document.querySelectorAll("[data-filter]");
  const cards = document.querySelectorAll("[data-works-list='all'] .work-card");

  if (filterButtons.length === 0 || cards.length === 0) {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const initialFilter = params.get("category") || "all";
  const initialButton =
    Array.from(filterButtons).find((button) => button.dataset.filter === initialFilter) ||
    Array.from(filterButtons).find((button) => button.dataset.filter === "all") ||
    filterButtons[0];

  applyCategoryFilter(initialButton.dataset.filter, false);

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      applyCategoryFilter(button.dataset.filter, true);
    });
  });

  function applyCategoryFilter(filter, shouldUpdateUrl) {
    filterButtons.forEach((button) => {
      const isSelected = button.dataset.filter === filter;
      button.classList.toggle("is-active", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });

    cards.forEach((card) => {
      card.hidden = filter !== "all" && card.dataset.category !== filter;
    });

    updateWorkCardLinks(filter);

    if (shouldUpdateUrl) {
      const nextUrl =
        filter === "all"
          ? window.location.pathname
          : `${window.location.pathname}?category=${encodeURIComponent(filter)}`;
      window.history.replaceState(null, "", nextUrl);
    }
  }
}

function updateWorkCardLinks(filter) {
  const links = document.querySelectorAll("[data-works-list='all'] .work-card__link");
  const query = filter === "all" ? "" : `?category=${encodeURIComponent(filter)}`;

  links.forEach((link) => {
    link.setAttribute("href", `${link.dataset.baseHref}${query}`);
  });
}

async function setupWorkPager() {
  try {
    const works = await getWorks();
    const category = new URLSearchParams(window.location.search).get("category");
    const currentSlug = getCurrentWorkSlug();

    updateWorksBackLink(category);

    if (!currentSlug) {
      return;
    }

    const scopedWorks =
      category && category !== "all"
        ? works.filter((work) => work.category === category)
        : works;
    const currentIndex = scopedWorks.findIndex((work) => work.slug === currentSlug);

    if (currentIndex === -1) {
      return;
    }

    if (scopedWorks.length < 2) {
      workPager.hidden = true;
      return;
    }

    const previousWork =
      scopedWorks[(currentIndex - 1 + scopedWorks.length) % scopedWorks.length];
    const nextWork = scopedWorks[(currentIndex + 1) % scopedWorks.length];
    const query =
      category && category !== "all" ? `?category=${encodeURIComponent(category)}` : "";

    workPager.innerHTML = `
      <a class="work-pager__link" href="../${encodeURI(previousWork.slug)}/${query}">
        <span aria-hidden="true">◀</span>
        ${escapeHtml(previousWork.title)}
      </a>
      <a class="work-pager__link work-pager__link--next" href="../${encodeURI(nextWork.slug)}/${query}">
        ${escapeHtml(nextWork.title)}
        <span aria-hidden="true">▶</span>
      </a>
    `;
  } catch (error) {
    console.error(error);
  }
}

function updateWorksBackLink(category) {
  const query =
    category && category !== "all" ? `?category=${encodeURIComponent(category)}` : "";
  const links = document.querySelectorAll(".button-row a");

  links.forEach((link) => {
    if (link.textContent.includes("作品一覧へ戻る")) {
      link.setAttribute("href", `../${query}`);
    }
  });
}

function getCurrentWorkSlug() {
  const segments = window.location.pathname.split("/").filter(Boolean);
  const worksIndex = segments.lastIndexOf("works");

  return worksIndex === -1 ? null : segments[worksIndex + 1] || null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
