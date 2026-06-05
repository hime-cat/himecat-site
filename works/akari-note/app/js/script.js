const STORAGE_KEY = "akari_entries";
const SEEN_HISTORY_STORAGE_KEY = "akari_seen_history";

const entryForm = document.querySelector("#entryForm");
const entryText = document.querySelector("#entryText");
const todayEntries = document.querySelector("#todayEntries");
const entrySearch = document.querySelector("#entrySearch");
const entryListHeading = document.querySelector("#entryListHeading");
const entriesList = document.querySelector("#entriesList");
const randomButton = document.querySelector("#randomButton");
const randomEntry = document.querySelector("#randomEntry");
const tabNav = document.querySelector(".tab-nav");
const homeTabButton = document.querySelector("[data-home-tab]");
const tabButtons = document.querySelectorAll("[data-tab]");
const tabPanels = document.querySelectorAll("[data-tab-panel]");
const entryFilter = document.querySelector(".list-filter");
const entryFilterButtons = document.querySelectorAll("[data-entry-filter]");
const authPanel = document.querySelector("#authPanel");
const authTitle = document.querySelector("#auth-title");
const authDescription = document.querySelector("#authDescription");
const storagePlace = document.querySelector("#storagePlace");
const storageDescription = document.querySelector("#storageDescription");
const authForm = document.querySelector("#authForm");
const authEmail = document.querySelector("#authEmail");
const authSubmitButton = document.querySelector("#authSubmitButton");
const authCodeForm = document.querySelector("#authCodeForm");
const authCode = document.querySelector("#authCode");
const authCodeSubmitButton = document.querySelector("#authCodeSubmitButton");
const authStatus = document.querySelector("#authStatus");

const supabaseClient = createSupabaseClient();

let lastRandomEntryId = null;
let newlyLitEntryId = null;
let softlyRestoredEntryId = null;
let currentEntryFilter = "all";
let currentSearchText = "";
let pendingAuthEmail = "";
let localEntriesProtected = false;
let lanternGlowTimer = null;

function createSupabaseClient() {
  const config = window.AKARI_SUPABASE_CONFIG;

  if (
    !window.supabase ||
    !config ||
    typeof config.url !== "string" ||
    typeof config.anonKey !== "string" ||
    !config.url ||
    !config.anonKey
  ) {
    return null;
  }

  return window.supabase.createClient(config.url, config.anonKey);
}

function loadEntries() {
  const savedEntries = localStorage.getItem(STORAGE_KEY);

  if (!savedEntries) {
    return [];
  }

  try {
    const entries = JSON.parse(savedEntries);
    return Array.isArray(entries)
      ? entries.map((entry) => {
          const { notes, ...entryWithoutNotes } = entry;
          return {
            ...entryWithoutNotes,
            bookmarked: Boolean(entry.bookmarked),
            updatedAt: entry.updatedAt || entry.createdAt,
          };
        })
      : [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function updateEntryPresenceState() {
  document.body.classList.toggle("has-akari-entries", loadEntries().length > 0);
}

function glowLantern() {
  document.body.classList.remove("is-lantern-lit");
  void document.body.offsetWidth;
  document.body.classList.add("is-lantern-lit");

  if (lanternGlowTimer) {
    clearTimeout(lanternGlowTimer);
  }

  lanternGlowTimer = setTimeout(() => {
    document.body.classList.remove("is-lantern-lit");
    lanternGlowTimer = null;
  }, 2200);
}

function revealLanternOnSmallScreen() {
  if (!window.matchMedia("(max-width: 640px)").matches) {
    return;
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

function isUuid(text) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    text
  );
}

function ensureEntryIdsForSupabase(entries) {
  const idMap = new Map();
  const entriesWithIds = entries.map((entry) => {
    if (isUuid(entry.id)) {
      return entry;
    }

    const id = createId();
    idMap.set(entry.id, id);

    return {
      ...entry,
      id,
    };
  });

  if (idMap.size === 0) {
    return entriesWithIds;
  }

  saveEntries(entriesWithIds);
  updateSeenHistoryIds(idMap);
  renderAllEntries();

  return entriesWithIds;
}

function loadSeenHistory() {
  const savedHistory = localStorage.getItem(SEEN_HISTORY_STORAGE_KEY);

  if (!savedHistory) {
    return {};
  }

  try {
    const history = JSON.parse(savedHistory);

    if (!history || Array.isArray(history) || typeof history !== "object") {
      return {};
    }

    return Object.entries(history).reduce((cleanedHistory, [id, seenAt]) => {
      const seenAtTime = Date.parse(seenAt);

      if (
        typeof id === "string" &&
        typeof seenAt === "string" &&
        !Number.isNaN(seenAtTime)
      ) {
        cleanedHistory[id] = seenAt;
      }

      return cleanedHistory;
    }, {});
  } catch {
    return {};
  }
}

function saveSeenHistory(history) {
  localStorage.setItem(SEEN_HISTORY_STORAGE_KEY, JSON.stringify(history));
}

function pruneSeenHistory(entries, history) {
  const entryIds = new Set(entries.map((entry) => entry.id));
  const nextHistory = Object.entries(history).reduce(
    (cleanedHistory, [id, seenAt]) => {
      if (entryIds.has(id)) {
        cleanedHistory[id] = seenAt;
      }

      return cleanedHistory;
    },
    {}
  );

  if (Object.keys(nextHistory).length !== Object.keys(history).length) {
    saveSeenHistory(nextHistory);
  }

  return nextHistory;
}

function markEntrySeen(id) {
  const history = loadSeenHistory();
  history[id] = new Date().toISOString();
  saveSeenHistory(history);
}

function removeEntrySeenHistory(id) {
  const history = loadSeenHistory();

  if (!history[id]) {
    return;
  }

  delete history[id];
  saveSeenHistory(history);
}

function updateSeenHistoryIds(idMap) {
  const history = loadSeenHistory();
  const nextHistory = Object.entries(history).reduce(
    (updatedHistory, [id, seenAt]) => {
      updatedHistory[idMap.get(id) || id] = seenAt;
      return updatedHistory;
    },
    {}
  );

  saveSeenHistory(nextHistory);
}

function formatDate(dateText) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateText));
}

function formatTime(dateText) {
  return new Intl.DateTimeFormat("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateText));
}

function formatMonthDateTime(dateText) {
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateText));
}

function formatMonthHeading(dateText) {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
  }).format(new Date(dateText));
}

function getMonthKey(dateText) {
  const date = new Date(dateText);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function normalizeText(text) {
  return text.trim().toLocaleLowerCase("ja-JP");
}

function pickRandomEntry(entries) {
  return entries[Math.floor(Math.random() * entries.length)];
}

function getSeenAtTime(history, id) {
  const seenAtTime = Date.parse(history[id]);
  return Number.isNaN(seenAtTime) ? 0 : seenAtTime;
}

function chooseRandomEntry(candidates, seenHistory) {
  const unseenEntries = candidates.filter((entry) => !seenHistory[entry.id]);

  if (unseenEntries.length > 0) {
    return pickRandomEntry(unseenEntries);
  }

  const rankedEntries = candidates
    .slice()
    .sort(
      (entryA, entryB) =>
        getSeenAtTime(seenHistory, entryA.id) -
        getSeenAtTime(seenHistory, entryB.id)
    );
  const totalWeight = rankedEntries.reduce(
    (total, _entry, index) => total + rankedEntries.length - index,
    0
  );
  let randomWeight = Math.random() * totalWeight;

  for (let index = 0; index < rankedEntries.length; index += 1) {
    const weight = rankedEntries.length - index;

    if (randomWeight < weight) {
      return rankedEntries[index];
    }

    randomWeight -= weight;
  }

  return rankedEntries[rankedEntries.length - 1];
}

function isSameDate(dateA, dateB) {
  return (
    dateA.getFullYear() === dateB.getFullYear() &&
    dateA.getMonth() === dateB.getMonth() &&
    dateA.getDate() === dateB.getDate()
  );
}

function setEntryMenuOpen(menuWrapper, isOpen) {
  const menuButton = menuWrapper.querySelector(".menu-button");

  menuWrapper.classList.toggle("is-open", isOpen);

  if (menuButton) {
    menuButton.setAttribute("aria-expanded", String(isOpen));

    if (!isOpen) {
      menuButton.blur();
    }
  }
}

function closeEntryMenus(exceptMenu = null) {
  document.querySelectorAll(".entry-menu.is-open").forEach((menuWrapper) => {
    if (menuWrapper !== exceptMenu) {
      setEntryMenuOpen(menuWrapper, false);
    }
  });
}

function createEntryCard(entry, options = {}) {
  const showFullDate = options.showFullDate ?? true;
  const showMonthDateTime = options.showMonthDateTime ?? false;
  const showDelete = options.showDelete ?? true;
  const showBookmark = options.showBookmark ?? true;
  const showMenu = options.showMenu ?? showDelete;
  const showEditAction = options.showEditAction ?? showMenu;
  const newlyLit = options.newlyLit ?? false;
  const softlyRestored = options.softlyRestored ?? false;
  const item = document.createElement("article");
  item.className = "entry-item";
  const card = document.createElement("article");
  card.className = "entry-card";
  card.classList.toggle("is-newly-lit", newlyLit);
  card.classList.toggle("is-softly-restored", softlyRestored);

  const text = document.createElement("p");
  text.className = "entry-text";
  text.textContent = entry.text;

  const meta = document.createElement("div");
  meta.className = "entry-meta";

  const time = document.createElement("time");
  time.dateTime = entry.createdAt;
  if (showMonthDateTime) {
    time.textContent = formatMonthDateTime(entry.createdAt);
  } else {
    time.textContent = showFullDate
      ? formatDate(entry.createdAt)
      : formatTime(entry.createdAt);
  }

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  meta.append(time, actions);
  const editForm = showEditAction ? createEditForm(entry) : null;

  if (showBookmark) {
    const bookmarkButton = document.createElement("button");
    bookmarkButton.type = "button";
    bookmarkButton.className = "bookmark-button";
    bookmarkButton.classList.toggle("is-bookmarked", entry.bookmarked);
    bookmarkButton.setAttribute("aria-pressed", String(entry.bookmarked));
    bookmarkButton.setAttribute(
      "aria-label",
      entry.bookmarked ? "しおりを外す" : "しおりを挟む"
    );

    const bookmarkLabel = document.createElement("span");
    bookmarkLabel.className = "sr-only";
    bookmarkLabel.textContent = entry.bookmarked
      ? "しおりを外す"
      : "しおりを挟む";

    bookmarkButton.append(bookmarkLabel);
    bookmarkButton.addEventListener("click", () => {
      toggleBookmark(entry.id);
    });

    actions.append(bookmarkButton);
  }

  if (showMenu) {
    const menuWrapper = document.createElement("div");
    menuWrapper.className = "entry-menu";

    const menuButton = document.createElement("button");
    menuButton.type = "button";
    menuButton.className = "menu-button";
    menuButton.setAttribute("aria-expanded", "false");
    menuButton.setAttribute("aria-label", "操作を開く");
    menuButton.textContent = "...";

    const menuPanel = document.createElement("div");
    menuPanel.className = "entry-menu-panel";

    if (showEditAction) {
      const editButton = document.createElement("button");
      editButton.type = "button";
      editButton.className = "menu-action-button";
      editButton.textContent = "直す";
      editButton.addEventListener("click", () => {
        setEntryMenuOpen(menuWrapper, false);
        editForm.hidden = false;
        editForm.querySelector("textarea").focus();
      });

      menuPanel.append(editButton);
    }

    if (showDelete) {
      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "menu-action-button delete-button";
      deleteButton.textContent = "消す";
      deleteButton.addEventListener("click", () => {
        deleteEntry(entry.id);
      });

      menuPanel.append(deleteButton);
    }

    menuButton.addEventListener("click", (event) => {
      event.stopPropagation();

      const isOpen = menuWrapper.classList.contains("is-open");
      closeEntryMenus(menuWrapper);
      setEntryMenuOpen(menuWrapper, !isOpen);
    });

    menuWrapper.append(menuButton, menuPanel);
    actions.append(menuWrapper);
  }

  card.append(meta, text);
  item.append(card);

  if (editForm) {
    item.append(editForm);
  }

  return item;
}

function createEditForm(entry) {
  const form = document.createElement("form");
  form.className = "edit-form";
  form.hidden = true;

  const textareaId = `edit-${entry.id}-${createId()}`;
  const label = document.createElement("label");
  label.className = "sr-only";
  label.htmlFor = textareaId;
  label.textContent = "灯りを直す";

  const textarea = document.createElement("textarea");
  textarea.id = textareaId;
  textarea.rows = 4;
  textarea.value = entry.text;
  textarea.placeholder = "灯りを少し直す";

  const actions = document.createElement("div");
  actions.className = "edit-form-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "edit-cancel-button";
  cancelButton.textContent = "閉じる";
  cancelButton.addEventListener("click", () => {
    textarea.value = entry.text;
    form.hidden = true;
  });

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.className = "edit-submit-button";
  submitButton.textContent = "保存";

  actions.append(cancelButton, submitButton);
  form.append(label, textarea, actions);

  form.addEventListener("submit", (event) => {
    event.preventDefault();

    const text = textarea.value.trim();

    if (!text) {
      return;
    }

    updateEntryText(entry.id, text);
  });

  return form;
}

function renderEntries() {
  const entries = loadEntries();
  entriesList.innerHTML = "";
  updateEntryListHeading();

  if (entries.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent =
      "まだ灯りはありません。今日の小さなよかったことを、ひとつ残してみてください。";
    entriesList.append(emptyMessage);
    entryListHeading.hidden = true;
    randomEntry.classList.remove("is-visible");
    randomEntry.textContent = "";
    return;
  }

  const visibleEntries =
    currentEntryFilter === "bookmarked"
      ? entries.filter((entry) => entry.bookmarked)
      : entries;
  const searchNeedle = normalizeText(currentSearchText);
  const searchedEntries = searchNeedle
    ? visibleEntries.filter((entry) =>
        normalizeText(entry.text).includes(searchNeedle)
      )
    : visibleEntries;

  if (searchedEntries.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent = getEmptyEntriesMessage();
    entriesList.append(emptyMessage);
    return;
  }

  const sortedEntries = searchedEntries
    .slice()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (searchNeedle) {
    sortedEntries.forEach((entry) => {
      entriesList.append(
        createEntryCard(entry, {
          showFullDate: false,
          showMonthDateTime: true,
          softlyRestored: entry.id === softlyRestoredEntryId,
        })
      );
    });

    return;
  }

  const entriesByMonth = new Map();

  sortedEntries.forEach((entry) => {
    const monthKey = getMonthKey(entry.createdAt);

    if (!entriesByMonth.has(monthKey)) {
      entriesByMonth.set(monthKey, []);
    }

    entriesByMonth.get(monthKey).push(entry);
  });

  entriesByMonth.forEach((monthEntries) => {
    const group = document.createElement("section");
    group.className = "month-group";

    const heading = document.createElement("h3");
    heading.className = "month-heading";
    heading.textContent = formatMonthHeading(monthEntries[0].createdAt);

    const monthList = document.createElement("div");
    monthList.className = "month-entries";

    monthEntries.forEach((entry) => {
      monthList.append(
        createEntryCard(entry, {
          showFullDate: false,
          showMonthDateTime: true,
          softlyRestored: entry.id === softlyRestoredEntryId,
        })
      );
    });

    group.append(heading, monthList);
    entriesList.append(group);
  });
}

function updateEntryListHeading() {
  const searchText = currentSearchText.trim();

  if (searchText && currentEntryFilter === "bookmarked") {
    entryListHeading.textContent = `「${currentSearchText}」のしおり`;
    entryListHeading.hidden = false;
    return;
  }

  if (searchText) {
    entryListHeading.textContent = `「${currentSearchText}」の灯り`;
    entryListHeading.hidden = false;
    return;
  }

  if (currentEntryFilter === "bookmarked") {
    entryListHeading.textContent = "栞を挟んだ灯り";
    entryListHeading.hidden = false;
    return;
  }

  entryListHeading.hidden = true;
}

function getEmptyEntriesMessage() {
  const searchText = currentSearchText.trim();

  if (searchText && currentEntryFilter === "bookmarked") {
    return "その言葉に近いしおりは、まだ見つかりませんでした。";
  }

  if (searchText) {
    return "その言葉に近い灯りは、まだ見つかりませんでした。";
  }

  return "しおりを挟んだ灯りはまだありません。残しておきたい灯りに、小さなしおりを挟めます。";
}

function renderTodayEntries() {
  const entries = loadEntries()
    .filter((entry) => isSameDate(new Date(entry.createdAt), new Date()))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  todayEntries.innerHTML = "";

  if (entries.length === 0) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "empty-message";
    emptyMessage.textContent =
      "今日の灯りはまだありません";
    todayEntries.append(emptyMessage);
    return;
  }

  entries.forEach((entry) => {
    todayEntries.append(
      createEntryCard(entry, {
        showFullDate: false,
        newlyLit: entry.id === newlyLitEntryId,
        softlyRestored: entry.id === softlyRestoredEntryId,
      })
    );
  });

  newlyLitEntryId = null;
}

function renderAllEntries() {
  updateEntryPresenceState();
  renderEntries();
  renderTodayEntries();
  softlyRestoredEntryId = null;
}

function addEntry(text) {
  const entries = loadEntries();
  const createdAt = new Date().toISOString();
  const entry = {
    id: createId(),
    text,
    createdAt,
    updatedAt: createdAt,
    bookmarked: false,
  };

  saveEntries([...entries, entry]);
  return entry;
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  if (window.crypto && typeof window.crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    );

    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function deleteEntry(id) {
  const currentEntries = loadEntries();
  const deletedEntry = currentEntries.find((entry) => entry.id === id);
  const entries = currentEntries.filter((entry) => entry.id !== id);

  saveEntries(entries);
  removeEntrySeenHistory(id);
  renderAllEntries();
  syncEntryDeletionToSupabase(deletedEntry);
}

function updateEntryText(id, text) {
  const updatedAt = new Date().toISOString();
  let updatedEntry = null;
  const entries = loadEntries().map((entry) => {
    if (entry.id !== id) {
      return entry;
    }

    updatedEntry = { ...entry, text, updatedAt };
    return updatedEntry;
  });

  saveEntries(entries);
  softlyRestoredEntryId = id;
  renderAllEntries();
  syncEntryToSupabase(updatedEntry);
}

function toggleBookmark(id) {
  const updatedAt = new Date().toISOString();
  let updatedEntry = null;
  const entries = loadEntries().map((entry) => {
    if (entry.id !== id) {
      return entry;
    }

    updatedEntry = {
      ...entry,
      bookmarked: !entry.bookmarked,
      updatedAt,
    };
    return updatedEntry;
  });

  saveEntries(entries);
  renderAllEntries();
  syncEntryToSupabase(updatedEntry);
}

function showRandomEntry() {
  const entries = loadEntries();
  const seenHistory = pruneSeenHistory(entries, loadSeenHistory());

  if (entries.length === 0) {
    lastRandomEntryId = null;
    randomEntry.classList.add("is-visible");
    randomEntry.textContent =
      "まだ思い出す灯りがありません。最初のひとつを残してみましょう。";
    playRandomEntryAnimation();
    return;
  }

  const candidates =
    entries.length > 1
      ? entries.filter((entry) => entry.id !== lastRandomEntryId)
      : entries;
  const entry = chooseRandomEntry(candidates, seenHistory);
  lastRandomEntryId = entry.id;
  markEntrySeen(entry.id);

  randomEntry.innerHTML = "";
  randomEntry.classList.add("is-visible");
  randomEntry.append(
    createEntryCard(entry, { showDelete: false, showBookmark: false })
  );
  playRandomEntryAnimation();
}

function playRandomEntryAnimation() {
  randomEntry.classList.remove("is-lit");
  void randomEntry.offsetWidth;
  randomEntry.classList.add("is-lit");
}

async function initializeAuthPanel() {
  if (!supabaseClient || !authPanel || !authForm) {
    return;
  }

  authPanel.hidden = false;

  const session = await getCurrentSession();

  if (session) {
    showAuthProtectedState("灯りを確かめています。");
    const protectedEntries = await protectLocalEntries();

    if (protectedEntries) {
      showAuthProtectedState();
    } else {
      showAuthRetryState();
    }
  } else {
    showAuthInputState();
  }
}

function showAuthInputState() {
  showLocalStorageState();

  if (authTitle) {
    authTitle.textContent = "別の端末でも見られるようにする";
  }

  if (authDescription) {
    authDescription.textContent =
      "メールアドレスに届くコードで認証すると、このブラウザの灯りをクラウドにも残せます。\n同じメールアドレスを使えば、別のブラウザや端末でも同じ灯りを見られます。";
  }

  authForm.hidden = false;
  authCodeForm.hidden = true;
}

function showAuthProtectedState(message = "") {
  showSyncedStorageState();

  if (authTitle) {
    authTitle.textContent = "灯りを見返せる場所が増えました";
  }

  if (authDescription) {
    authDescription.textContent =
      "同じメールアドレスを使えば、別のブラウザや端末でも同じ灯りを見られます。";
  }

  authForm.hidden = true;
  authCodeForm.hidden = true;

  if (message) {
    showAuthStatus(message);
  } else {
    authStatus.hidden = true;
    authStatus.classList.remove("is-error");
  }
}

function showAuthRetryState() {
  showLocalStorageState();

  if (authTitle) {
    authTitle.textContent = "もう一度、灯りを守る";
  }

  if (authDescription) {
    authDescription.textContent =
      "必要なら、同じメールアドレスに届くコードでもう一度確かめられます。";
  }

  authForm.hidden = false;
  authCodeForm.hidden = true;
}

function showLocalStorageState() {
  if (storagePlace) {
    storagePlace.textContent = "このブラウザ";
  }

  if (storageDescription) {
    storageDescription.textContent = "灯りはこのブラウザに残ります";
  }
}

function showSyncedStorageState() {
  if (storagePlace) {
    storagePlace.textContent = "このブラウザとクラウド";
  }

  if (storageDescription) {
    storageDescription.textContent =
      "灯りはこのブラウザにも残り、ほかの端末でも見られます";
  }
}

function showAuthStatus(message, options = {}) {
  authStatus.textContent = message;
  authStatus.hidden = false;
  authStatus.classList.toggle("is-error", Boolean(options.error));
}

async function sendAuthCode(email) {
  return supabaseClient.auth.signInWithOtp({
    email,
  });
}

async function verifyAuthCode(email, token) {
  return supabaseClient.auth.verifyOtp({
    email,
    token,
    type: "email",
  });
}

async function getCurrentSession() {
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    return null;
  }

  return data.session;
}

async function getCurrentUser() {
  const { data, error } = await supabaseClient.auth.getUser();

  if (error) {
    return null;
  }

  return data.user;
}

function toSupabaseEntry(entry, userId) {
  return {
    id: entry.id,
    user_id: userId,
    text: entry.text,
    created_at: entry.createdAt,
    bookmarked: Boolean(entry.bookmarked),
    updated_at: entry.updatedAt || entry.createdAt,
  };
}

function toSupabaseDeletedEntry(entry, userId, deletedAt) {
  return {
    ...toSupabaseEntry(entry, userId),
    updated_at: deletedAt,
    deleted_at: deletedAt,
  };
}

function fromSupabaseEntry(row) {
  return {
    id: row.id,
    text: row.text,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    bookmarked: Boolean(row.bookmarked),
  };
}

function isValidEntry(entry) {
  return Boolean(
    entry &&
      isUuid(entry.id) &&
      typeof entry.text === "string" &&
      entry.text.trim() &&
      typeof entry.createdAt === "string" &&
      !Number.isNaN(Date.parse(entry.createdAt)) &&
      typeof entry.updatedAt === "string" &&
      !Number.isNaN(Date.parse(entry.updatedAt))
  );
}

function mergeEntryPair(localEntry, remoteEntry) {
  const localUpdatedAt = Date.parse(
    localEntry.updatedAt || localEntry.createdAt
  );
  const remoteUpdatedAt = Date.parse(
    remoteEntry.updatedAt || remoteEntry.createdAt
  );
  const newerEntry =
    remoteUpdatedAt > localUpdatedAt ? remoteEntry : localEntry;

  return {
    ...newerEntry,
    id: localEntry.id,
    createdAt: localEntry.createdAt,
    updatedAt: newerEntry.updatedAt || newerEntry.createdAt,
    bookmarked: Boolean(newerEntry.bookmarked),
  };
}

function getDeletedEntryIds(rows) {
  if (!Array.isArray(rows)) {
    return new Set();
  }

  return rows.reduce((deletedEntryIds, row) => {
    if (row && row.deleted_at && isUuid(row.id)) {
      deletedEntryIds.add(row.id);
    }

    return deletedEntryIds;
  }, new Set());
}

function removeEntriesById(entries, entryIds) {
  if (entryIds.size === 0) {
    return entries;
  }

  entryIds.forEach((id) => {
    removeEntrySeenHistory(id);
  });

  return entries.filter((entry) => !entryIds.has(entry.id));
}

function mergeEntries(localEntries, remoteEntries) {
  const mergedEntries = new Map();

  localEntries.forEach((entry) => {
    if (isValidEntry(entry)) {
      mergedEntries.set(entry.id, entry);
    }
  });

  remoteEntries.forEach((entry) => {
    if (!isValidEntry(entry)) {
      return;
    }

    const localEntry = mergedEntries.get(entry.id);
    mergedEntries.set(
      entry.id,
      localEntry ? mergeEntryPair(localEntry, entry) : entry
    );
  });

  return Array.from(mergedEntries.values()).sort(
    (entryA, entryB) =>
      Date.parse(entryA.createdAt) - Date.parse(entryB.createdAt)
  );
}

async function syncEntryToSupabase(entry) {
  if (!supabaseClient || !isValidEntry(entry)) {
    return;
  }

  try {
    const session = await getCurrentSession();

    if (!session) {
      return;
    }

    const user = await getCurrentUser();

    if (!user) {
      return;
    }

    const { error } = await supabaseClient
      .from("entries")
      .upsert([toSupabaseEntry(entry, user.id)], { onConflict: "id" });

    if (!error) {
      return;
    }
  } catch {
    // 画面の灯りは端末に残るので、静かな案内だけ出す。
  }

  if (authStatus) {
    showAuthStatus(
      "今は灯りを預けられませんでした。端末には残っています。",
      { error: true }
    );
    showAuthRetryState();
  }
}

async function syncEntryDeletionToSupabase(entry) {
  if (!supabaseClient || !isValidEntry(entry)) {
    return;
  }

  try {
    const session = await getCurrentSession();

    if (!session) {
      return;
    }

    const user = await getCurrentUser();

    if (!user) {
      return;
    }

    const deletedAt = new Date().toISOString();
    const { error } = await supabaseClient
      .from("entries")
      .upsert([toSupabaseDeletedEntry(entry, user.id, deletedAt)], {
        onConflict: "id",
      });

    if (!error) {
      return;
    }
  } catch {
    // 画面からは消えているので、別端末への反映だけ静かに案内する。
  }

  if (authStatus) {
    showAuthStatus(
      "今は削除を預けられませんでした。この端末では消えています。",
      { error: true }
    );
    showAuthRetryState();
  }
}

async function protectLocalEntries() {
  if (localEntriesProtected) {
    return true;
  }

  const user = await getCurrentUser();

  if (!user) {
    showAuthStatus("コードを確かめられませんでした。もう一度試せます。", {
      error: true,
    });
    return false;
  }

  const entries = ensureEntryIdsForSupabase(loadEntries());

  const { data: remoteRows, error: readError } = await supabaseClient
    .from("entries")
    .select("id, text, created_at, bookmarked, updated_at, deleted_at");

  if (readError) {
    showAuthStatus(
      "今は灯りを迎えにいけませんでした。端末には残っています。",
      { error: true }
    );
    return false;
  }

  const deletedEntryIds = getDeletedEntryIds(remoteRows);
  const activeLocalEntries = removeEntriesById(entries, deletedEntryIds);
  const remoteEntries = Array.isArray(remoteRows)
    ? remoteRows.filter((row) => !row.deleted_at).map(fromSupabaseEntry)
    : [];
  const mergedEntries = mergeEntries(activeLocalEntries, remoteEntries);

  saveEntries(mergedEntries);
  renderAllEntries();

  if (mergedEntries.length === 0) {
    localEntriesProtected = true;
    showAuthStatus("この端末の灯りを守れる状態です。");
    return true;
  }

  const rows = mergedEntries.map((entry) => toSupabaseEntry(entry, user.id));
  const { error } = await supabaseClient
    .from("entries")
    .upsert(rows, { onConflict: "id" });

  if (error) {
    showAuthStatus(
      "今は灯りを預けられませんでした。端末には残っています。",
      { error: true }
    );
    return false;
  }

  localEntriesProtected = true;
  showAuthStatus("この端末の灯りを預けました。端末にも残っています。");
  return true;
}

entryForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const text = entryText.value.trim();

  if (!text) {
    return;
  }

  const entry = addEntry(text);
  newlyLitEntryId = entry.id;
  entryText.value = "";
  entryText.blur();
  revealLanternOnSmallScreen();
  glowLantern();
  renderAllEntries();
  syncEntryToSupabase(entry);
});

randomButton.addEventListener("click", showRandomEntry);

document.addEventListener("click", (event) => {
  if (!event.target.closest(".entry-menu")) {
    closeEntryMenus();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeEntryMenus();
  }
});

if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      return;
    }

    const email = authEmail.value.trim();

    if (!email) {
      return;
    }

    authSubmitButton.disabled = true;
    authSubmitButton.textContent = "送っています";
    authStatus.hidden = true;
    authStatus.classList.remove("is-error");

    try {
      const { error } = await sendAuthCode(email);

      if (error) {
        showAuthStatus(
          "今はコードを送れませんでした。端末には灯りが残っています。",
          { error: true }
        );
        return;
      }

      pendingAuthEmail = email;
      authCodeForm.hidden = false;
      authCode.value = "";
      authCode.focus();
      showAuthStatus(
        "メールを送りました。届いたコードをここに入れてください。"
      );
    } catch {
      showAuthStatus(
        "今はコードを送れませんでした。端末には灯りが残っています。",
        { error: true }
      );
    } finally {
      authSubmitButton.disabled = false;
      authSubmitButton.textContent = "メールにコードを送る";
    }
  });
}

if (authCodeForm) {
  authCodeForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!supabaseClient) {
      return;
    }

    const email = pendingAuthEmail || authEmail.value.trim();
    const token = authCode.value.trim();

    if (!email || !token) {
      return;
    }

    authCodeSubmitButton.disabled = true;
    authCodeSubmitButton.textContent = "確かめています";
    authStatus.hidden = true;
    authStatus.classList.remove("is-error");

    try {
      const { error } = await verifyAuthCode(email, token);

      if (error) {
        showAuthStatus("コードを確かめられませんでした。もう一度試せます。", {
          error: true,
        });
        return;
      }

      authCode.value = "";
      authEmail.value = "";
      pendingAuthEmail = "";
      authCodeForm.hidden = true;
      showAuthStatus("灯りを預けています。");
      const protectedEntries = await protectLocalEntries();

      if (protectedEntries) {
        showAuthProtectedState();
      } else {
        showAuthRetryState();
      }
    } catch {
      showAuthStatus("コードを確かめられませんでした。もう一度試せます。", {
        error: true,
      });
    } finally {
      authCodeSubmitButton.disabled = false;
      authCodeSubmitButton.textContent = "コードを確かめる";
    }
  });
}

entrySearch.addEventListener("input", () => {
  currentSearchText = entrySearch.value.trim();
  renderEntries();
});

entrySearch.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    entrySearch.blur();
  }
});

entryFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentEntryFilter = button.dataset.entryFilter;
    entryFilter.dataset.activeFilter = currentEntryFilter;

    entryFilterButtons.forEach((filterButton) => {
      const isActive = filterButton.dataset.entryFilter === currentEntryFilter;
      filterButton.classList.toggle("is-active", isActive);
      filterButton.setAttribute("aria-pressed", String(isActive));
    });

    renderEntries();
  });
});

function activateTab(tabName) {
  tabNav.dataset.activeTab = tabName;

  tabButtons.forEach((tabButton) => {
    const isActive = tabButton.dataset.tab === tabName;
    tabButton.classList.toggle("is-active", isActive);
    tabButton.setAttribute("aria-selected", String(isActive));
  });

  tabPanels.forEach((panel) => {
    const isActive = panel.dataset.tabPanel === tabName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function getInitialTabName() {
  const tabName = window.location.hash.replace("#", "");
  const hasTab = Array.from(tabButtons).some(
    (tabButton) => tabButton.dataset.tab === tabName
  );

  return hasTab ? tabName : "write";
}

homeTabButton.addEventListener("click", () => {
  activateTab("write");
});

tabButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activateTab(button.dataset.tab);
  });
});

activateTab(getInitialTabName());
renderAllEntries();
initializeAuthPanel();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((error) => {
      console.warn("Service Worker registration failed.", error);
    });
  });
}
