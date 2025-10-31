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
  "mona lisa": [["mona", "lisa"], ["mona"], ["monalisa"]],
  "girl with a pearl earring": [
    ["girl", "pearl"],
    ["pearl", "earring"],
    ["girl", "earring"],
    ["pearl"],
  ],
  "starry night": [["starry", "night"], ["starrynight"], ["night", "starry"]],
  "the scream": [["scream"]],
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

  const sayA = (message, delay = 480) =>
    typeThenReply(
      "A",
      askAgent({
        role: "agentA",
        message,
        currentRoom: room,
        history: buildHistory(messages),
        lastArtwork: lastArtworkKey,
      }),
      delay
    );

  const sayB = (message, delay = 620) =>
    typeThenReply(
      "B",
      askAgent({
        role: "agentB",
        message,
        currentRoom: room,
        history: buildHistory(messages),
        lastArtwork: lastArtworkKey,
      }),
      delay
    );

  const onSend = async (text) => {
    setMessages((prev) => [...prev, { ...USER, text }]);

    if (pendingStep === "awaitNavigate") {
      if (isAffirmative(text)) {
        if (pendingRoom) setRoom(pendingRoom);
        await sayA(
          `We are in the ${pendingRoom} room now. Would you like to see "${pendingArtworkKey}"?`
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
          `Okay. We're in the ${stayRoom} room. What would you like to see next?`
        );
      }
      return;
    }

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

    if (/^(hi|hello|hey|salam|salaam)\b/i.test(text.trim())) {
      await sayA(
        userName
          ? `The visitor greeted. Reply as Agent A with one friendly line and ask what they'd like to see. Use their name "${userName}" if available.`
          : `The visitor greeted. Reply as Agent A with one friendly line and ask what they'd like to see.`
      );
      return;
    }

    if (/\b(thanks|thank you|tnx|thx)\b/i.test(text)) {
      await sayA(
        "Respond politely (e.g., 'You're welcome. I'm glad to help.'). Then ask if they'd like to see another masterpiece."
      );
      return;
    }

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

    const target = pickRoomByText(text);
    if (target) {
      setRoom(target);
      await sayA(`We're heading to the ${target} room.`);
      return;
    }

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
            ? "Give a short, helpful navigation-style answer without art analysis. If it's a broad question like 'what do you have', summarize available rooms and the four masterpieces, then ask what they'd like to see."
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
