/* ── Chunav Mitra — Frontend Logic ──────────────────────────────────────── */

const API_URL = "/chat";

/* ── Tab switching ────────────────────────────────────────────────────────── */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
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
  const optionsHtml = q.options.map((opt, i) => {
    const letter = opt.charAt(0);
    const text   = opt.slice(3);
    return `
      <button class="quiz-option" data-letter="${letter}" onclick="selectOption(this, '${q.answer}')">
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
}

window.selectOption = function(btn, correctLetter) {
  if (quizAnswered) return;
  quizAnswered = true;
  quizTotal++;

  const chosen = btn.dataset.letter;
  document.querySelectorAll(".quiz-option").forEach(opt => {
    opt.disabled = true;
    if (opt.dataset.letter === correctLetter) opt.classList.add("correct");
    else if (opt.dataset.letter === chosen) opt.classList.add("wrong");
  });

  if (chosen === correctLetter) quizScore++;
  document.getElementById("quiz-explanation").classList.add("visible");
  scoreEl.innerHTML = `Score: <strong>${quizScore}</strong> / ${quizTotal}`;
  btnNext.disabled = false;
};

btnNext.addEventListener("click", loadQuiz);

/* ═══════════════════════════════════════════════════════════════════════════
   GLOSSARY TAB
════════════════════════════════════════════════════════════════════════════ */
const glossarySearch  = document.getElementById("glossary-search");
const glossaryResult  = document.getElementById("glossary-result");
const glossaryTerms   = document.querySelectorAll(".glossary-term-btn");

const GLOSSARY_TERMS = [
  "EVM", "VVPAT", "EPIC", "ECI", "MCC", "Lok Sabha", "Rajya Sabha",
  "Vidhan Sabha", "Nomination", "Scrutiny", "Delimitation", "By-election",
  "Model Code of Conduct", "Returning Officer", "Reserved Constituency",
  "NOTA", "Voter Registration", "RPA 1951", "Polling Booth", "Counting Agent"
];

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
