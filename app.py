import os
import json
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.after_request
def security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response

# ── Gemini setup ────────────────────────────────────────────────────────────
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY is not set. Check your .env file.")

genai.configure(api_key=api_key)
model = genai.GenerativeModel("gemini-1.5-flash-latest")

# ── System prompts ───────────────────────────────────────────────────────────
BASE_SYSTEM_PROMPT = """
You are Chunav Mitra (चुनाव मित्र), a friendly and neutral election education assistant
created to help Indian citizens understand the democratic process.

YOUR SCOPE — only answer questions related to:
- Indian elections: Lok Sabha, Rajya Sabha, State Legislative Assemblies (Vidhan Sabha/Parishad)
- Election Commission of India (ECI) — structure, powers, role
- Voter ID / EPIC cards — how to apply, check status, correct details
- Electoral rolls — how to register, check, update
- Model Code of Conduct (MCC) — what it is, when it applies, what it prohibits
- Electronic Voting Machines (EVMs) — how they work, security features
- VVPAT (Voter Verifiable Paper Audit Trail) — purpose and process
- Election timeline — notification, nomination, scrutiny, withdrawal, polling, counting
- Candidate eligibility — age, qualifications, disqualifications
- Reserved constituencies — SC/ST reservations, delimitation
- Counting and result declaration process
- Government formation — majority, coalition, President's role
- By-elections and re-polls
- Political parties — registration, recognition, symbols

RULES:
1. Always be politically neutral. Never express opinions about parties, leaders, or policies.
2. If a question is outside your scope, politely say: "I can only help with questions about
   the Indian election process. Please ask me about voting, ECI, EVMs, timelines, etc."
3. Keep answers clear, simple, and beginner-friendly. Use bullet points for multi-step processes.
4. When relevant, cite the relevant law or ECI guideline (e.g., "Under the RPA 1951...").
5. Maximum response length: 250 words for chat mode, 80 words for glossary mode.
"""

QUIZ_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT + """

QUIZ MODE: The user has requested a quiz question.
Return ONLY valid JSON (no markdown, no backticks, no extra text) in this exact format:
{
  "question": "Question text here",
  "options": ["A. Option 1", "B. Option 2", "C. Option 3", "D. Option 4"],
  "answer": "A",
  "explanation": "Brief explanation of why this is correct (1-2 sentences)."
}
Topics to draw from: EVM mechanics, ECI powers, MCC rules, VVPAT, voter registration,
election timeline steps, candidate eligibility, government formation rules.
Make questions factual, not opinionated. Vary difficulty across requests.
"""

GLOSSARY_SYSTEM_PROMPT = BASE_SYSTEM_PROMPT + """

GLOSSARY MODE: The user wants a definition.
Return a concise definition in 2-3 sentences maximum. Include:
- Full form of the acronym if applicable
- What it is / what it does
- One concrete example or fact

Do NOT return JSON. Return plain text only.
"""

# ── Helpers ──────────────────────────────────────────────────────────────────
def build_prompt(message: str, context: str) -> tuple[str, str]:
    """Return (system_prompt, user_message) based on context."""
    ctx = context.lower().strip() if context else "chat"

    if ctx == "quiz":
        return QUIZ_SYSTEM_PROMPT, "Generate a quiz question about the Indian election process."
    elif ctx == "glossary":
        return GLOSSARY_SYSTEM_PROMPT, f"Define this election term in simple language: {message}"
    else:
        return BASE_SYSTEM_PROMPT, message


def sanitize(text: str, max_len: int = 500) -> str:
    """Basic input sanitization."""
    return text.strip()[:max_len]


def gemini_reply_text(response) -> str | None:
    """Extract plain text from a Gemini response, or None if unavailable."""
    try:
        txt = response.text
    except (ValueError, AttributeError):
        return None
    if txt is None:
        return None
    s = txt.strip()
    return s if s else None


def validate_quiz_payload(obj: dict) -> bool:
    if not isinstance(obj, dict):
        return False
    if not isinstance(obj.get("question"), str) or not obj["question"].strip():
        return False
    opts = obj.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        return False
    if not all(isinstance(o, str) and o.strip() for o in opts):
        return False
    ans = obj.get("answer")
    if not isinstance(ans, str) or len(ans.strip()) != 1 or ans.strip() not in "ABCD":
        return False
    if not isinstance(obj.get("explanation"), str) or not obj["explanation"].strip():
        return False
    return True


# ── Routes ────────────────────────────────────────────────────────────────────
@app.route("/")
def index():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():
    try:
        data = request.get_json(force=True, silent=True)
        if not data:
            return jsonify({"error": "Invalid JSON body"}), 400

        raw_message = data.get("message", "").strip()
        context = data.get("context", "chat")

        if not raw_message and context != "quiz":
            return jsonify({"error": "Message cannot be empty"}), 400

        message = sanitize(raw_message)
        system_prompt, user_message = build_prompt(message, context)

        # Combine system prompt + user message for Gemini
        full_prompt = f"{system_prompt}\n\nUser: {user_message}"
        response = model.generate_content(full_prompt)
        reply_text = gemini_reply_text(response)
        if reply_text is None:
            return jsonify({"error": "No response from the model. Please try again."}), 502

        # For quiz context, validate JSON before returning
        if context.lower() == "quiz":
            try:
                # Strip accidental markdown fences
                clean = reply_text.replace("```json", "").replace("```", "").strip()
                parsed = json.loads(clean)
                if not validate_quiz_payload(parsed):
                    return jsonify({"error": "Quiz format was invalid. Please try again."}), 500
                return jsonify({"reply": parsed, "context": "quiz"})
            except json.JSONDecodeError:
                return jsonify({"error": "Quiz generation failed. Please try again."}), 500

        return jsonify({"reply": reply_text, "context": context})

    except genai.types.generation_types.BlockedPromptException:
        return jsonify({"error": "Your message was flagged. Please rephrase."}), 400
    except Exception as e:
        app.logger.error(f"Error in /chat: {e}")
        return jsonify({"error": "An internal error occurred. Please try again."}), 500


@app.route("/health")
def health():
    return jsonify({"status": "ok"}), 200


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port, debug=False)
