(() => {
  "use strict";

  const STORAGE_KEY = "doomscrolling.stopper.entries.v3";
  const MAX_ENTRIES = 15;

  const views = {
    compose: document.getElementById("composeView"),
    review: document.getElementById("reviewView"),
    detail: document.getElementById("detailView")
  };

  const inputForm = document.getElementById("inputForm");
  const headerActions = document.getElementById("headerActions");
  const input = document.getElementById("moyamoyaInput");
  const guideGrid = document.getElementById("guideGrid");
  const guideDisclosure = document.getElementById("guideDisclosure");
  const nextStepHint = document.getElementById("nextStepHint");
  const promptPanel = document.getElementById("promptPanel");
  const promptOutput = document.getElementById("promptOutput");
  const copyPromptButton = document.getElementById("copyPromptButton");
  const openChatGptLink = document.getElementById("openChatGptLink");
  const resultPanel = document.getElementById("resultPanel");
  const aiResultInput = document.getElementById("aiResultInput");
  const entriesList = document.getElementById("entriesList");
  const emptyState = document.getElementById("emptyState");
  const saveCount = document.getElementById("saveCount");
  const detailHero = document.getElementById("detailHero");
  const detailContent = document.getElementById("detailContent");

  let lastRawInput = "";

  const labels = [
    ["theme", "🧭 テーマ"],
    ["known", "📌 今わかっていること"],
    ["selfGuess", "🌀 自分が推測していること"],
    ["undecided", "❔ まだ決まっていないこと"],
    ["noConclusion", "🧱 今ここで結論を出さなくていいこと"],
    ["possibleNow", "🪜 今の段階で出来ること"]
  ];

  const labelAliases = new Map([
    ["テーマ", "theme"],
    ["今わかっていること", "known"],
    ["自分が推測していること", "selfGuess"],
    ["まだ決まっていないこと", "undecided"],
    ["今ここで結論を出さなくていいこと", "noConclusion"],
    ["今の段階で出来ること", "possibleNow"]
  ]);

  function readEntries() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (Array.isArray(stored)) {
        return stored.filter((entry) => !["sample-ai-work-v2", "sample-ai-work-v3"].includes(entry.id));
      }
    } catch (error) {
      console.warn("Failed to read entries", error);
    }
    return [];
  }

  function writeEntries(entries) {
    const activeEntries = entries
      .filter((entry) => !entry.deletedAt)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      .slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(activeEntries));
  }

  function visibleEntries() {
    return readEntries()
      .filter((entry) => !entry.deletedAt)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  function showView(name) {
    Object.entries(views).forEach(([viewName, element]) => {
      element.classList.toggle("view-active", viewName === name);
    });
    renderHeaderActions(name);

    if (name === "review") {
      renderEntries();
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function renderHeaderActions(viewName) {
    const actionsByView = {
      compose: [
        { label: "見返す", view: "review", tone: "ghost" }
      ],
      review: [
        { label: "整理する", view: "compose", tone: "ghost" }
      ],
      detail: [
        { label: "整理する", view: "compose", tone: "ghost" },
        { label: "見返す", view: "review", tone: "ghost" }
      ]
    };

    headerActions.innerHTML = "";
    (actionsByView[viewName] || actionsByView.compose).forEach((action) => {
      const button = document.createElement("button");
      button.className = "ghost-button";
      button.type = "button";
      button.textContent = action.label;
      button.addEventListener("click", () => showView(action.view));
      headerActions.append(button);
    });
  }

  function createPrompt(text) {
    return `あなたは「反芻ストッパー / Doomscrolling Stopper」という、情報探索を一旦止めるための整理補助AIです。

目的は、不安を消すことではなく、今ある情報を整理して「現時点ではここまで」と区切れる状態を作ることです。
会話を広げすぎず、深掘りしすぎず、以下の固定見出しだけで返してください。

出力ルール:
- 返答全体を1つの text コードブロックに入れてください。
- コードブロックの外には何も書かないでください。
- 見出し名は変えないでください。
- 断定しすぎず、現時点で分かる範囲にしてください。
- 「探索状態」や診断名のような分析ラベルは出力しないでください。
- 各見出しの先頭の絵文字もそのまま使ってください。
- 「自分が推測していること」は、事実ではなく不安から予測している内容を分けてください。
- 「今ここで結論を出さなくていいこと」は、考えを止めてもよい理由として書いてください。
- 「今の段階で出来ること」は義務やタスクではなく、圧の低い小さな足場として書いてください。
- 最後に追加質問をしないでください。

入力:
${text}

返答フォーマット:

\`\`\`text
🧭 テーマ:

📌 今わかっていること:

🌀 自分が推測していること:

❔ まだ決まっていないこと:

🧱 今ここで結論を出さなくていいこと:

🪜 今の段階で出来ること:
\`\`\``;
  }

  function normalizeLabel(label) {
    return label.replace(/[^\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}A-Za-z0-9]/gu, "");
  }

  function parseAiResult(text) {
    const cleanedText = stripCodeFence(text);
    const parsed = {};
    const allLabels = [...labelAliases.keys()];
    const headingPattern = new RegExp(
      `^\\s*(?:[\\p{Emoji_Presentation}\\p{Extended_Pictographic}]\\s*)?(${allLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\s*[:：]\\s*$`,
      "gmu"
    );

    const matches = [...cleanedText.matchAll(headingPattern)];

    if (matches.length === 0) {
      parsed.known = cleanedText.trim();
      return parsed;
    }

    matches.forEach((match, index) => {
      const labelText = normalizeLabel(match[1]);
      const key = labelAliases.get(labelText);
      if (!key) {
        return;
      }
      const start = match.index + match[0].length;
      const end = matches[index + 1] ? matches[index + 1].index : cleanedText.length;
      const value = cleanedText.slice(start, end).trim();
      parsed[key] = parsed[key] ? `${parsed[key]}\n${value}`.trim() : value;
    });

    return parsed;
  }

  function firstLine(text) {
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) || "";
  }

  function stripCodeFence(text) {
    return text
      .trim()
      .replace(/^```(?:text|txt|markdown)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  function createEntry(parsed, rawInput, aiResult) {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `entry-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      theme: parsed.theme || inferTheme(rawInput),
      known: parsed.known || "",
      selfGuess: parsed.selfGuess || "",
      undecided: parsed.undecided || "",
      noConclusion: parsed.noConclusion || "",
      possibleNow: parsed.possibleNow || "",
      rawInput,
      aiResult,
      status: "前回の整理"
    };
  }

  function inferTheme(text) {
    const line = firstLine(text).replace(/^・/, "").trim();
    return line ? line.slice(0, 24) : "未整理の反芻";
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(new Date(value));
  }

  function isToday(value) {
    const date = new Date(value);
    const today = new Date();
    return date.getFullYear() === today.getFullYear()
      && date.getMonth() === today.getMonth()
      && date.getDate() === today.getDate();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderEntries() {
    const entries = visibleEntries();
    entriesList.innerHTML = "";
    saveCount.textContent = `保存 ${entries.length} / ${MAX_ENTRIES}`;
    emptyState.classList.toggle("hidden", entries.length > 0);

    entries.forEach((entry) => {
      const button = document.createElement("button");
      button.className = "entry-card";
      button.type = "button";
      button.innerHTML = `
        <span>
          <span class="entry-title">${escapeHtml(entry.theme)}</span>
          <span class="entry-summary">${escapeHtml(getKnown(entry) || "整理を保存しました")}</span>
        </span>
        <span class="entry-meta">
          ${isToday(entry.updatedAt) ? '<span class="state-pill">今日の整理</span>' : '<span></span>'}
          <span>${escapeHtml(formatDate(entry.updatedAt))}</span>
        </span>
      `;
      button.addEventListener("click", () => renderDetail(entry.id));
      entriesList.append(button);
    });
  }

  function renderDetail(id) {
    const entry = readEntries().find((item) => item.id === id && !item.deletedAt);
    if (!entry) {
      showView("review");
      return;
    }

    detailHero.innerHTML = `
      <div>
        <p class="eyebrow">前回の整理</p>
        <h1 id="detailTitle">🧭 ${escapeHtml(entry.theme)}</h1>
      </div>
      <p class="detail-date">${escapeHtml(formatDate(entry.updatedAt))}</p>
    `;

    detailContent.innerHTML = `
      ${rawInputDisclosure(entry.rawInput)}
      ${detailSection("📌 今わかっていること", getKnown(entry))}
      ${detailSection("🌀 自分が推測していること", entry.selfGuess)}
      ${detailSection("❔ まだ決まっていないこと", getUndecided(entry))}
      ${detailSection("🧱 今ここで結論を出さなくていいこと", entry.noConclusion)}
      ${detailSection("🪜 今の段階で出来ること", entry.possibleNow)}
      <div class="detail-actions">
        <button class="quiet-button" type="button" id="backToReviewButton">見返すへ戻る</button>
        <button class="danger-button" type="button" id="hideEntryButton">この整理を削除する</button>
      </div>
    `;

    document.getElementById("backToReviewButton").addEventListener("click", () => showView("review"));

    document.getElementById("hideEntryButton").addEventListener("click", () => {
      if (!confirm("この整理を削除しますか？")) {
        return;
      }
      const now = new Date().toISOString();
      const entries = readEntries().map((item) => {
        if (item.id !== entry.id) {
          return item;
        }
        return { ...item, deletedAt: now, updatedAt: now };
      });
      writeEntries(entries);
      showView("review");
    });

    showView("detail");
  }

  function detailSection(title, body) {
    if (!body) {
      return "";
    }
    return `
      <section class="detail-section">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(body)}</p>
      </section>
    `;
  }

  function rawInputDisclosure(rawInput) {
    if (!rawInput) {
      return "";
    }
    return `
      <details class="raw-input-disclosure">
        <summary>もとの入力を見る</summary>
        <p>${escapeHtml(rawInput)}</p>
      </details>
    `;
  }

  function getKnown(entry) {
    return entry.known || "";
  }

  function getUndecided(entry) {
    return entry.undecided || "";
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(promptOutput.value);
      copyPromptButton.textContent = "コピーしました";
      copyPromptButton.classList.remove("action-emphasis");
      openChatGptLink.classList.add("action-emphasis");
      openChatGptLink.classList.add("mobile-copy-ready");
    } catch (error) {
      promptOutput.focus();
      promptOutput.select();
    }
  }

  inputForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    lastRawInput = text;
    promptOutput.value = createPrompt(text);
    copyPromptButton.textContent = "コピー";
    copyPromptButton.classList.add("action-emphasis");
    openChatGptLink.classList.remove("action-emphasis");
    openChatGptLink.classList.remove("mobile-copy-ready");
    guideGrid.classList.add("hidden");
    guideDisclosure.classList.remove("hidden");
    guideDisclosure.open = false;
    nextStepHint.classList.remove("hidden");
    promptPanel.classList.remove("hidden");
    resultPanel.classList.remove("hidden");
  });

  document.getElementById("copyPromptButton").addEventListener("click", copyPrompt);

  document.getElementById("clearInputButton").addEventListener("click", () => {
    input.value = "";
    nextStepHint.classList.add("hidden");
    guideGrid.classList.remove("hidden");
    guideDisclosure.classList.add("hidden");
    guideDisclosure.open = false;
    promptPanel.classList.add("hidden");
    resultPanel.classList.add("hidden");
    input.focus();
  });

  document.getElementById("saveResultButton").addEventListener("click", () => {
    const result = aiResultInput.value.trim();
    if (!result) {
      aiResultInput.focus();
      return;
    }

    const rawInput = lastRawInput || input.value.trim();
    const entry = createEntry(parseAiResult(result), rawInput, result);
    writeEntries([entry, ...readEntries()]);
    input.value = "";
    lastRawInput = "";
    nextStepHint.classList.add("hidden");
    guideGrid.classList.remove("hidden");
    guideDisclosure.classList.add("hidden");
    guideDisclosure.open = false;
    promptPanel.classList.add("hidden");
    resultPanel.classList.add("hidden");
    promptOutput.value = "";
    aiResultInput.value = "";
    renderDetail(entry.id);
  });

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => showView(button.dataset.view));
  });

  writeEntries(readEntries());
  renderHeaderActions("compose");
  renderEntries();

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.warn("Service worker registration failed", error);
      });
    });
  }
})();
