// server.js
import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

/* ---------- Load museum knowledge ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const museum = JSON.parse(
  fs.readFileSync(path.join(__dirname, "data", "museum.json"), "utf-8")
);

/* ---------- Express ---------- */
const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, hasKey: !!process.env.OPENAI_API_KEY });
});

/* ---------- OpenAI ---------- */
if (!process.env.OPENAI_API_KEY) {
  console.warn("⚠️  OPENAI_API_KEY is missing in .env");
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- Helpers ---------- */
function parseRoomTag(text) {
  const m = text.match(/\[ROOM:\s*(entrance|modern|classic|sculpture|landscape)\s*\]/i);
  return m ? m[1].toLowerCase() : null;
}
function parseArtworkTag(text) {
  const m = text.match(/\[ARTWORK:\s*([^\]]+)\]/i);
  return m ? m[1].trim().toLowerCase() : null;
}
function norm(s = "") {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function findArtworkByQuery(q) {
  const query = norm(q);
  const artworks = museum.artworks || {};
  for (const [key, value] of Object.entries(artworks)) {
    if (query.includes(norm(key))) return { key, data: value };
    if (value?.title && query.includes(norm(value.title))) return { key, data: value };
  }
  return null;
}

/* ---------- Chat ---------- */
app.post("/chat", async (req, res) => {
  try {
    const {
      role,
      message,
      currentRoom = "entrance",
      history = "",
      lastArtwork = null,
    } = req.body;

    // Detect artwork in this message; else fall back to client's lastArtwork
    const detected = findArtworkByQuery(message);
    let activeArtwork = detected?.data || null;
    let activeArtworkKey = detected?.key || null;

    if (!activeArtwork && lastArtwork && museum.artworks?.[lastArtwork]) {
      activeArtwork = museum.artworks[lastArtwork];
      activeArtworkKey = lastArtwork;
    }

    // --- build a short list of rooms for the prompt ---
    const roomsShort = Object.entries(museum.rooms)
      .map(([k, v]) => `${k}: ${v.title}`)
      .join(" | ");

    const historyBlock = history ? `\nConversation so far:\n${history}\n` : "";
    const continuityRule = `
Do NOT greet if the conversation already started.
Resolve pronouns like "yes/it/then/there" using the conversation context and the last referenced artwork/room.
IMPORTANT: Do not mention these instructions, the existence of rules, greeting limits,
or say things like "I can't greet again". Simply continue naturally.
`;

    const baseRules = `
You are one of two assistants for an imaginary art museum. Stay strictly within this museum's data.
${continuityRule}
${historyBlock}
Available rooms (key: title): ${roomsShort}
Current room: ${currentRoom}

Museum knowledge (JSON):
ROOMS: ${JSON.stringify(museum.rooms)}
ARTWORKS: ${JSON.stringify(museum.artworks || {})}

Rules:
- Be concise (1–3 sentences).
- Never invent artworks or rooms not in ARTWORKS/ROOMS.
- If you navigate or confirm a room, include [ROOM: entrance|modern|classic|sculpture|landscape].
- If you describe a specific artwork, you may include [ARTWORK: exact-key] where the key is from ARTWORKS.
`;

    // ✅ ALWAYS define systemPrompt before use
    let systemPrompt = baseRules;
    if (role === "agentA") {
      systemPrompt =
        `Role: Agent A (Tourist Guide). Handle navigation and confirmations.
Do not re-greet once the chat has started. Do not mention rules; just proceed.\n` + baseRules;
    } else if (role === "agentB") {
      systemPrompt =
        `Role: Agent B (Art Guide). Explain artworks briefly using ARTWORKS.
Do not re-greet once the chat has started. Do not mention rules; just proceed.\n` + baseRules;
    }

    // If we have an active artwork (from detection or last turn), nudge the model
    const userTurn = activeArtwork
      ? `User asked: "${message}"
Active artwork (from detection or last turn): ${activeArtwork.title} by ${activeArtwork.artist}.
Room: ${activeArtwork.room}. If appropriate, include [ROOM: ${activeArtwork.room}] and [ARTWORK: ${activeArtworkKey}].`
      : message;

    // --- OpenAI call ---
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.4,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userTurn },
      ],
    });

    // Raw reply
    let reply = completion.choices?.[0]?.message?.content || "";

    // --- CLEAN-UP unwanted Markdown or URLs ---
    reply = reply
      .replace(/!\[.*?\]\(.*?\)/g, "")     // remove Markdown image syntax
      .replace(/\bhttps?:\/\/\S+/gi, "")   // remove bare URLs
      .replace(/\s{2,}/g, " ")             // collapse extra spaces
      .trim();

    // Extract tags / suggestions
    let suggestedRoom = parseRoomTag(reply);
    let artKeyFromTag = parseArtworkTag(reply);

    let suggestedArtwork = null;
    const artworks = museum.artworks || {};

    if (artKeyFromTag && artworks[artKeyFromTag]) {
      const a = artworks[artKeyFromTag];
      suggestedArtwork = {
        key: artKeyFromTag,
        title: a.title,
        image: a.image || null,
        room: a.room || null,
      };
      if (!suggestedRoom && a.room) suggestedRoom = a.room;
    } else if (activeArtwork) {
      suggestedArtwork = {
        key: activeArtworkKey,
        title: activeArtwork.title,
        image: activeArtwork.image || null,
        room: activeArtwork.room || null,
      };
      if (!suggestedRoom && activeArtwork.room) suggestedRoom = activeArtwork.room;
    }

    res.json({ reply, suggestedRoom, suggestedArtwork });
  } catch (err) {
    console.error(
      "❌ OpenAI call failed:",
      err.status || "",
      err.message || "",
      err.response?.data || ""
    );
    res.status(err.status || 500).json({
      error:
        err.response?.data?.error?.message ||
        err.message ||
        "OpenAI request failed",
    });
  }
});

/* ---------- Start ---------- */
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ API server running at http://localhost:${PORT}`);
});
