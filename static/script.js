/* ── Chunav Mitra — Frontend Logic ──────────────────────────────────────── */

const API_URL = "/chat";

/* ── Tab switching ────────────────────────────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => {
      b.classList.remove("active");
      b.setAttribute("aria-selected", "false");
    });
    document.querySelectorAll(".tab-panel").forEach(p => {
      p.classList.remove("active");
      p.hidden = true;
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    const panel = document.getElementById(btn.dataset.tab);
    panel.classList.add("active");
    panel.hidden = false;
  });
});

/* Panels start hidden except first (CSS handles .active); keep hidden in sync for a11y */
document.querySelectorAll(".tab-panel").forEach(panel => {
  panel.hidden = !panel.classList.contains("active");
});

/* ═══════════════════════════════════════════════════════════════════════════
   CHAT TAB
════════════════════════════════════════════════════════════════════════════ */
const chatWindow = document.getElementById("chat-window");
const chatInput  = document.getElementById("chat-input");
const chatForm   = document.getElementById("chat-form");

function appendMsg(text, role) {
  const isBot = role === "bot";
  const div = document.createElement("div");
  div.className = `msg ${role}`;
  div.innerHTML = `
    <div class="msg-avatar">${isBot ? "🗳️" : "👤"}</div>
    <div class="msg-bubble">${escapeHtml(text).replace(/\n/g, "<br>")}</div>
  `;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function showTyping() {
  const div = document.createElement("div");
  div.className = "msg bot";
  div.id = "typing-indicator";
  div.innerHTML = `
    <div class="msg-avatar">🗳️</div>
    <div class="msg-bubble">
      <div class="typing-dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function removeTyping() {
  const el = document.getElementById("typing-indicator");
  if (el) el.remove();
}

async function sendChat(message) {
  if (!message.trim()) return;
  appendMsg(message, "user");
  chatInput.value = "";
  document.getElementById("btn-send").disabled = true;
  showTyping();

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context: "chat" })
    });
    const data = await res.json();
    removeTyping();
    if (data.error) {
      appendMsg("⚠️ " + data.error, "bot");
    } else {
      appendMsg(data.reply, "bot");
    }
  } catch {
    removeTyping();
    appendMsg("⚠️ Could not connect to the server. Please try again.", "bot");
  } finally {
    document.getElementById("btn-send").disabled = false;
    chatInput.focus();
  }
}

chatForm.addEventListener("submit", e => {
  e.preventDefault();
  sendChat(chatInput.value.trim());
});

// Quick chips
document.querySelectorAll(".chip").forEach(chip => {
  chip.addEventListener("click", () => sendChat(chip.dataset.q));
});

/* ═══════════════════════════════════════════════════════════════════════════
   QUIZ TAB
════════════════════════════════════════════════════════════════════════════ */
let quizScore = 0;
let quizTotal = 0;
let quizAnswered = false;

const quizArea   = document.getElementById("quiz-area");
const btnNext    = document.getElementById("btn-next");
const scoreEl    = document.getElementById("quiz-score");

async function loadQuiz() {
  quizArea.innerHTML = `
    <div class="quiz-loading">
      <div class="spinner"></div>
      <div>Generating your question...</div>
    </div>
  `;
  btnNext.disabled = true;
  quizAnswered = false;

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "", context: "quiz" })
    });
    const data = await res.json();

    if (data.error || !data.reply) {
      quizArea.innerHTML = `<p style="color:#C0392B;padding:20px">${data.error || "Failed to load question. Try again."}</p>`;
      btnNext.disabled = false;
      return;
    }

    renderQuiz(data.reply);
  } catch {
    quizArea.innerHTML = `<p style="color:#C0392B;padding:20px">Connection error. Please try again.</p>`;
    btnNext.disabled = false;
  }
}

function renderQuiz(q) {
  const correct = String(q.answer || "").trim().toUpperCase();
  if (
    !/^[A-D]$/.test(correct) ||
    !Array.isArray(q.options) ||
    q.options.length !== 4
  ) {
    quizArea.innerHTML = `<p style="color:#C0392B;padding:20px">Invalid question format. Tap Next Question.</p>`;
    btnNext.disabled = false;
    return;
  }

  const optionsHtml = q.options.map((opt) => {
    const raw = String(opt).trim();
    const m = raw.match(/^([A-Da-d])[.)]\s*(.*)$/);
    const letter = m ? m[1].toUpperCase() : raw.charAt(0).toUpperCase();
    const text = (m ? m[2] : raw.slice(3)).trim();
    return `
      <button type="button" class="quiz-option" data-letter="${letter}">
        <span class="option-letter">${letter}</span>
        ${escapeHtml(text)}
      </button>
    `;
  }).join("");

  quizArea.innerHTML = `
    <p class="quiz-question">${escapeHtml(q.question)}</p>
    <div class="quiz-options">${optionsHtml}</div>
    <div class="quiz-explanation" id="quiz-explanation">
      💡 ${escapeHtml(q.explanation)}
    </div>
  `;

  quizArea.querySelectorAll(".quiz-option").forEach((btn) => {
    btn.addEventListener("click", () => selectOption(btn, correct));
  });
}

function selectOption(btn, correctLetter) {
  if (quizAnswered) return;
  quizAnswered = true;
  quizTotal++;

  const chosen = String(btn.dataset.letter || "").toUpperCase();
  document.querySelectorAll(".quiz-option").forEach(opt => {
    opt.disabled = true;
    const L = String(opt.dataset.letter || "").toUpperCase();
    if (L === correctLetter) opt.classList.add("correct");
    else if (L === chosen) opt.classList.add("wrong");
  });

  if (chosen === correctLetter) quizScore++;
  const expl = document.getElementById("quiz-explanation");
  if (expl) expl.classList.add("visible");
  scoreEl.innerHTML = `Score: <strong>${quizScore}</strong> / ${quizTotal}`;
  btnNext.disabled = false;
}

btnNext.addEventListener("click", loadQuiz);

/* ═══════════════════════════════════════════════════════════════════════════
   GLOSSARY TAB
════════════════════════════════════════════════════════════════════════════ */
const glossarySearch  = document.getElementById("glossary-search");
const glossaryResult  = document.getElementById("glossary-result");
const glossaryTerms   = document.querySelectorAll(".glossary-term-btn");

async function lookupTerm(term) {
  glossaryResult.style.display = "none";
  glossaryResult.classList.remove("visible");
  glossaryResult.innerHTML = `
    <div style="text-align:center;padding:16px">
      <div class="spinner"></div>
      <div style="font-size:13px;color:var(--ink-muted);margin-top:8px">Looking up <em>${escapeHtml(term)}</em>…</div>
    </div>
  `;
  glossaryResult.style.display = "block";

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: term, context: "glossary" })
    });
    const data = await res.json();
    if (data.error) {
      glossaryResult.innerHTML = `<p style="color:#C0392B">${data.error}</p>`;
    } else {
      glossaryResult.innerHTML = `
        <h3>${escapeHtml(term)}</h3>
        <p>${escapeHtml(data.reply).replace(/\n/g, "<br>")}</p>
      `;
      glossaryResult.classList.add("visible");
    }
  } catch {
    glossaryResult.innerHTML = `<p style="color:#C0392B">Connection error.</p>`;
  }
}

glossaryTerms.forEach(btn => {
  btn.addEventListener("click", () => lookupTerm(btn.dataset.term));
});

glossarySearch.addEventListener("keydown", e => {
  if (e.key === "Enter" && glossarySearch.value.trim()) {
    lookupTerm(glossarySearch.value.trim());
  }
});

// Filter term buttons
glossarySearch.addEventListener("input", () => {
  const q = glossarySearch.value.toLowerCase();
  glossaryTerms.forEach(btn => {
    btn.style.display = btn.dataset.term.toLowerCase().includes(q) ? "" : "none";
  });
});

/* ── Utilities ────────────────────────────────────────────────────────────── */
function escapeHtml(str) {
  if (typeof str !== "string") str = String(str);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ── Init ─────────────────────────────────────────────────────────────────── */
document.addEventListener("DOMContentLoaded", () => {
  loadQuiz(); // pre-load first quiz question
});
