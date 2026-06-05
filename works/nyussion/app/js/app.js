const tagGroups = [
  {
    title: "今の状態",
    tags: [
      "🔋 処理容量少なめ",
      "🫧 うまく伝えられない",
      "🧩 理解できなくて混乱中",
      "☁️ まだ頭の整理中",
    ],
  },
  {
    title: "話し方の希望",
    tags: [
      "🫖 やさしめ希望",
      "📦 情報少なめだと助かる",
      "🐢 ゆっくり話したい",
    ],
  },
  {
    title: "今したいこと",
    tags: [
      "🌱 少し落ち着きたい",
      "🚶 少し歩きたい",
      "🌿 外の空気吸いたい",
      "🌙 今日は休みたい",
    ],
  },
  {
    title: "関係について",
    tags: ["🫂 仲良くしたい気持ちはある"],
  },
];

const messageInput = document.querySelector("#message");
const tagGroupsElement = document.querySelector("[data-tag-groups]");
const previewElement = document.querySelector("[data-preview]");
const selectedCountElement = document.querySelector("[data-selected-count]");
const lineShareElement = document.querySelector("[data-line-share]");
const copyButton = document.querySelector("[data-copy]");
const clearButton = document.querySelector("[data-clear-tags]");
const statusElement = document.querySelector("[data-status]");

const selectedTags = new Set();
let statusTimerId = 0;

function renderTags() {
  tagGroupsElement.innerHTML = "";

  tagGroups.forEach((group) => {
    const groupElement = document.createElement("section");
    groupElement.className = "tag-group";

    const titleElement = document.createElement("h3");
    titleElement.className = "tag-group-title";
    titleElement.textContent = group.title;

    const listElement = document.createElement("div");
    listElement.className = "tag-list";

    group.tags.forEach((tag) => {
      const button = document.createElement("button");
      button.className = "tag-button";
      button.type = "button";
      button.textContent = tag;
      button.setAttribute("aria-pressed", "false");
      button.dataset.tag = tag;
      listElement.append(button);
    });

    groupElement.append(titleElement, listElement);
    tagGroupsElement.append(groupElement);
  });
}

function createShareText() {
  const message = messageInput.value.trim();
  const tags = Array.from(selectedTags);

  if (!message && tags.length === 0) {
    return "";
  }

  if (!message) {
    return tags.join("\n");
  }

  if (tags.length === 0) {
    return message;
  }

  return `${message}\n\n${tags.join("\n")}`;
}

function updatePreview(options = {}) {
  const shareText = createShareText();
  const selectedCount = selectedTags.size;
  const tags = Array.from(selectedTags);

  previewElement.textContent = tags.join("\n");
  selectedCountElement.textContent =
    selectedCount === 0 ? "タグなし" : `タグ ${selectedCount}個`;
  lineShareElement.href = `https://line.me/R/share?text=${encodeURIComponent(
    shareText
  )}`;

  if (options.scrollToLatest) {
    previewElement.scrollTop = previewElement.scrollHeight;
  }
}

function setStatus(message) {
  window.clearTimeout(statusTimerId);
  statusElement.textContent = message;

  statusTimerId = window.setTimeout(() => {
    statusElement.textContent = "";
  }, 2600);
}

function toggleTag(button) {
  const tag = button.dataset.tag;
  const isSelected = selectedTags.has(tag);

  if (isSelected) {
    selectedTags.delete(tag);
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  } else {
    selectedTags.add(tag);
    button.classList.add("is-selected");
    button.setAttribute("aria-pressed", "true");
  }

  updatePreview({ scrollToLatest: !isSelected });
}

async function copyShareText() {
  const shareText = createShareText();

  if (!shareText) {
    setStatus("本文かタグをひとつ入れるとコピーできます");
    return;
  }

  try {
    await navigator.clipboard.writeText(shareText);
    setStatus("コピーしました");
  } catch {
    const fallbackInput = document.createElement("textarea");
    fallbackInput.value = shareText;
    fallbackInput.setAttribute("readonly", "");
    fallbackInput.style.position = "fixed";
    fallbackInput.style.opacity = "0";
    document.body.append(fallbackInput);
    fallbackInput.select();
    document.execCommand("copy");
    fallbackInput.remove();
    setStatus("コピーしました");
  }
}

function clearTags() {
  selectedTags.clear();

  document.querySelectorAll(".tag-button").forEach((button) => {
    button.classList.remove("is-selected");
    button.setAttribute("aria-pressed", "false");
  });

  updatePreview();
}

renderTags();
updatePreview();

messageInput.addEventListener("input", updatePreview);

tagGroupsElement.addEventListener("click", (event) => {
  const button = event.target.closest(".tag-button");

  if (!button) {
    return;
  }

  toggleTag(button);
});

clearButton.addEventListener("click", clearTags);
copyButton.addEventListener("click", copyShareText);

lineShareElement.addEventListener("click", (event) => {
  if (!createShareText()) {
    event.preventDefault();
    setStatus("本文かタグをひとつ入れると共有できます");
  }
});
