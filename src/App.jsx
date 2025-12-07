import React, { useEffect, useState } from "react";
import Gallery from "./components/Gallery";
import ChatPanel from "./components/ChatPanel";
import "./app.css";

function buildHistory(list) {
  return list
    .slice(-12)
    .map((m) => {
      const who =
        m.role === "user" ? "User" : m.role === "agentA" ? "AgentA" : "AgentB";
      return `${who}: ${m.text}`;
    })
    .join("\n");
}

const isAffirmative = (t) =>
  /^(y(es)?|yeah|yep|sure|ok(ay)?|please do|go ahead|let'?s go|do it|why not)\b/i.test(
    t.trim()
  );

const AGENT_A = { role: "agentA", avatar: "/images/agentA.png" };
const AGENT_B = { role: "agentB", avatar: "/images/agentB.png" };
const USER = { role: "user", avatar: "/images/user.png" };

const ROOM_MAP = {
  entrance: "/images/entrance.jpg",
  modern: "/images/modern.jpg",
  classic: "/images/classic.jpg",
  sculpture: "/images/sculpture.jpg",
  landscape: "/images/landscape.jpg",
};

const ARTWORK_MAP = {
  "mona lisa": { image: "/images/mona_lisa.jpg", room: "classic" },
  "girl with a pearl earring": {
    image: "/images/girl_with_pearl.jpg",
    room: "classic",
  },
  "starry night": { image: "/images/starry_night.jpg", room: "modern" },
  "the scream": { image: "/images/the_scream.jpg", room: "modern" },
};

const normalize = (s) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const ARTWORK_TOKENS = {
  "mona lisa": [
    ["mona", "lisa"],
    ["mona"],
    ["monalisa"],
    ["monaliza"],
    ["mona liza"],
  ],
  "girl with a pearl earring": [
    ["girl", "pearl"],
    ["pearl", "earring"],
    ["girl", "earring"],
    ["pearl"],
  ],
  "starry night": [
    ["starry", "night"],
    ["starrynight"],
    ["night", "starry"],
    ["starynight"],
    ["stary", "night"],
  ],
  "the scream": [["scream"], ["screem"], ["skreem"], ["skream"], ["sream"]],
};

function pickArtworkByText(t) {
  const s = " " + normalize(t) + " ";

  for (const key of Object.keys(ARTWORK_MAP)) {
    if (s.includes(" " + key + " ")) return key;
  }

  for (const [key, tokenSets] of Object.entries(ARTWORK_TOKENS)) {
    for (const tokens of tokenSets) {
      const ok = tokens.every((tok) => s.includes(" " + tok + " "));
      if (ok) return key;
    }
  }
  return null;
}

function pickRoomByText(t) {
  const s = t.toLowerCase();
  if (/(modern|abstract|contemporary)/.test(s)) return "modern";
  if (/(classic|renaissance|baroque|old)/.test(s)) return "classic";
  if (/(sculpt|statue|3d)/.test(s)) return "sculpture";
  if (/(landscape|nature)/.test(s)) return "landscape";
  if (/(entrance|lobby|main hall|home)/.test(s)) return "entrance";
  return null;
}

// Detect only "pure" greetings like "hello", "hello!", "hi :)"
function isPureGreeting(text) {
  const t = text.trim().toLowerCase();
  const m = /^(hi|hello|hey|salam|salaam)\b/.exec(t);
  if (!m) return false;

  const rest = t.slice(m[0].length).trim();
  if (!rest) return true;
  if (/^[\s.!?…,:;()-]+$/.test(rest)) return true;

  return false;
}

async function askAgent({ role, message, currentRoom, history, lastArtwork }) {
  const res = await fetch("http://localhost:3001/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, message, currentRoom, history, lastArtwork }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export default function App({ initialName = "" }) {
  const [userName, setUserName] = useState(initialName);
  const [room, setRoom] = useState("entrance");
  const [imageSrc, setImageSrc] = useState(ROOM_MAP[room]);

  const [pendingStep, setPendingStep] = useState("idle");
  const [pendingRoom, setPendingRoom] = useState(null);
  const [pendingArtworkKey, setPendingArtworkKey] = useState(null);

  const [messages, setMessages] = useState(() => {
    if (initialName) {
      return [
        {
          ...AGENT_A,
          text: `Hi ${initialName}! Welcome to the museum. I’m Agent A (tourist guide).`,
        },
        {
          ...AGENT_B,
          text: `Hello ${initialName}! I’m Agent B (art guide). Ask me about any masterpiece.`,
        },
      ];
    }
    return [
      {
        ...AGENT_A,
        text: "Hi! Welcome to the museum. I’m Agent A (tourist guide).",
      },
      {
        ...AGENT_B,
        text: "Hello! I’m Agent B (art guide). Ask me about any masterpiece.",
      },
    ];
  });

  const [isTypingA, setTypingA] = useState(false);
  const [isTypingB, setTypingB] = useState(false);
  const [lastResponder, setLastResponder] = useState("B");
  const [lastArtworkKey, setLastArtworkKey] = useState(null);

  useEffect(() => {
    setImageSrc(ROOM_MAP[room] || ROOM_MAP.entrance);
  }, [room]);

  async function typeThenReply(agent, textPromise, delay = 600) {
    const setTyping = agent === "A" ? setTypingA : setTypingB;
    const who = agent === "A" ? AGENT_A : AGENT_B;

    setTyping(true);
    try {
      await new Promise((r) => setTimeout(r, delay));
      const { reply } = await textPromise;
      setMessages((prev) => [...prev, { ...who, text: reply }]);
      setLastResponder(agent);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          ...who,
          text: "⚠️ Error contacting the AI service. Please try again.",
        },
      ]);
    } finally {
      setTyping(false);
    }
  }

  // allow optional overrideRoom so we don't rely on async state for the backend
  const sayA = (message, delay = 480, overrideRoom = null) =>
    typeThenReply(
      "A",
      askAgent({
        role: "agentA",
        message,
        currentRoom: overrideRoom ?? room,
        history: buildHistory(messages),
        lastArtwork: lastArtworkKey,
      }),
      delay
    );

  const sayB = (message, delay = 620, overrideRoom = null) =>
    typeThenReply(
      "B",
      askAgent({
        role: "agentB",
        message,
        currentRoom: overrideRoom ?? room,
        history: buildHistory(messages),
        lastArtwork: lastArtworkKey,
      }),
      delay
    );

  const onSend = async (text) => {
    setMessages((prev) => [...prev, { ...USER, text }]);

    // 1) user just answered our navigation question
    if (pendingStep === "awaitNavigate") {
      if (isAffirmative(text)) {
        const newRoom = pendingRoom || room;

        // update React state
        setRoom(newRoom);

        // tell backend explicitly that we're now in newRoom
        // IMPORTANT: only say we're in the room and ASK if they want to see the artwork.
        // Do NOT describe or show the artwork yet.
        await sayA(
          `
We have now moved to the ${newRoom} room.
In one short sentence, tell the visitor that they are in the ${newRoom} room
and ask if they would like to see "${pendingArtworkKey}".
Do NOT describe the artwork and do NOT say that it is already in front of them.
`.trim(),
          480,
          newRoom
        );

        setPendingStep("awaitArtworkConfirm");
      } else {
        setPendingStep("idle");
        setPendingRoom(null);
        setPendingArtworkKey(null);
        await sayA("No problem. Where would you like to go next?");
      }
      return;
    }

    // 2) user answered whether to actually show the artwork
    if (pendingStep === "awaitArtworkConfirm") {
      if (isAffirmative(text)) {
        const art = ARTWORK_MAP[pendingArtworkKey];
        if (art?.image) setImageSrc(art.image);
        setLastArtworkKey(pendingArtworkKey);

        setPendingStep("idle");
        const shownKey = pendingArtworkKey;
        setPendingArtworkKey(null);
        setPendingRoom(null);

        await new Promise((r) => setTimeout(r, 180));
        await sayB(
          `Give a concise (1–2 sentence) description of "${shownKey}". Do NOT mention rooms, moving, directions, or navigation.`
        );
      } else {
        const stayRoom = pendingRoom || room;
        setPendingStep("idle");
        setPendingArtworkKey(null);
        setPendingRoom(null);
        await sayA(
          `Okay. We're in the ${stayRoom} room. What would you like to see next?`,
          480,
          stayRoom
        );
      }
      return;
    }

    // 3) name capture
    if (!userName) {
      const m =
        text.match(
          /\b(i\s*am|i['’]?\s*m|my\s+name\s+is)\s+([A-Za-z][\w-]*)\b/i
        ) || (/^[A-Za-z][\w-]*$/.test(text.trim()) ? [, , text.trim()] : null);
      if (m) {
        const name = m[2];
        setUserName(name);
        await sayA(`The visitor's name is ${name}. Greet them briefly.`, 350);
        await sayB(
          "Ask what they want to explore next (one short question). Do not greet; do not mention not greeting.",
          600
        );
        return;
      }
    }

    // 4) greetings
    if (isPureGreeting(text)) {
      await sayA(
        userName
          ? `The visitor greeted. Reply as Agent A with one friendly line and ask what they'd like to see. Use their name "${userName}" if available.`
          : `The visitor greeted. Reply as Agent A with one friendly line and ask what they'd like to see.`
      );
      return;
    }

    // 5) thanks
    if (/\b(thanks|thank\s*you|thanku|thanx|tnx|thx)\b/i.test(text)) {
      setMessages((prev) => [
        ...prev,
        {
          ...AGENT_A,
          text: "You're welcome! Would you like to see another masterpiece?",
        },
      ]);
      setLastResponder("A");
      return;
    }

    // 6) user mentioned a specific artwork
    const artKey = pickArtworkByText(text);
    if (artKey && ARTWORK_MAP[artKey]) {
      const artRoom = ARTWORK_MAP[artKey].room;
      setPendingRoom(artRoom);
      setPendingArtworkKey(artKey);
      setPendingStep("awaitNavigate");
      await sayA(
        `The visitor asked for "${artKey}". Ask in one short sentence for permission to go to the ${artRoom} room. Do not move yet.`
      );
      return;
    }

    // 7) user mentioned a room explicitly
    const target = pickRoomByText(text);
    if (target) {
      setRoom(target);
      await sayA(`We're heading to the ${target} room.`, 480, target);
      return;
    }

    // 8) fallback: generic navigation / art answer
    const s = text.toLowerCase().trim();
    const wantDirection =
      /\b(show|take|go|navigate|where|how do i get|back to|lead|guide)\b/.test(
        s
      );
    const responder = wantDirection ? "A" : "A";
    const role = responder === "A" ? "agentA" : "agentB";
    await typeThenReply(
      responder,
      askAgent({
        role,
        message:
          role === "agentA"
            ? `
You are Agent A, the tourist-guide assistant in a small virtual art museum.
Give a short, helpful navigation-style answer without any art analysis.

- If it is a broad question like "what do you have", summarize the available rooms
  and the four masterpieces, then ask what the visitor would like to see.
- If the user asks for something that is NOT one of the museum rooms or one of the
  four artworks (for example: pizza, coffee, shop, tickets, food, or anything unrelated
  to the collection), politely say that the museum does not have that.
  Then explicitly list the available rooms and the four artworks again and ask the visitor
  which of those they would like to see next.
`.trim()
            : "Give a short art answer (1–2 sentences). Do not mention rooms or directions.",
        currentRoom: room,
        history: buildHistory([...messages, { ...USER, text }]),
        lastArtwork: lastArtworkKey,
      }),
      responder === "A" ? 480 : 620
    );
  };

  return (
    <div className="layout">
      <aside className="left">
        <Gallery src={imageSrc} />
      </aside>
      <main className="right">
        <ChatPanel
          messages={messages}
          onSend={onSend}
          isTypingA={isTypingA}
          isTypingB={isTypingB}
        />
      </main>
    </div>
  );
}
