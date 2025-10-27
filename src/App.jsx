import React, { useEffect, useState, useMemo } from "react";
import Gallery from "./components/Gallery";
import ChatPanel from "./components/ChatPanel";
import "./app.css";

/* ===== Utilities ===== */
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

/* avatars */
const AGENT_A = { role: "agentA", avatar: "/images/agentA.png" };
const AGENT_B = { role: "agentB", avatar: "/images/agentB.png" };
const USER = { role: "user", avatar: "/images/user.png" };

/* rooms */
const ROOM_MAP = {
  entrance: "/images/entrance.jpg",
  modern: "/images/modern.jpg",
  classic: "/images/classic.jpg",
  sculpture: "/images/sculpture.jpg",
  landscape: "/images/landscape.jpg",
};

/* ------- ONLY FOUR MASTERPIECES ------- */
const ARTWORK_MAP = {
  "mona lisa": { image: "/images/mona_lisa.jpg", room: "classic" },
  "girl with a pearl earring": {
    image: "/images/girl_with_pearl.jpg",
    room: "classic",
  },
  "starry night": { image: "/images/starry_night.jpg", room: "modern" },
  "the scream": { image: "/images/the_scream.jpg", room: "modern" },
};

/* aliases */
const ALIASES = {
  monalisa: "mona lisa",
  "mona-lisa": "mona lisa",
  mona: "mona lisa",
  girlwithapearlearring: "girl with a pearl earring",
  "girl-with-a-pearl-earring": "girl with a pearl earring",
  pearlearring: "girl with a pearl earring",
  starrynight: "starry night",
  "the-starry-night": "starry night",
  scream: "the scream",
};

/* helpers */
function pickRoomByText(t) {
  const s = t.toLowerCase();
  if (/(modern|abstract|contemporary)/.test(s)) return "modern";
  if (/(classic|renaissance|baroque|old)/.test(s)) return "classic";
  if (/(sculpt|statue|3d)/.test(s)) return "sculpture";
  if (/(landscape|nature)/.test(s)) return "landscape";
  if (/(entrance|lobby|main hall|home)/.test(s)) return "entrance";
  return null;
}

function normalize(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function pickArtworkByText(t) {
  const s = t.toLowerCase();
  const direct = Object.keys(ARTWORK_MAP).find((k) => s.includes(k)) || null;
  if (direct) return direct;
  const sn = normalize(s);
  for (const [alias, canonical] of Object.entries(ALIASES)) {
    if (sn.includes(normalize(alias))) return canonical;
  }
  return null;
}

function isAffirmative(t) {
  return /^(y(es)?|yeah|yup|ok(ay)?|sure|please do|go ahead|let's go)\b/i.test(
    t.trim()
  );
}
function isNegative(t) {
  return /^(no|nope|not now|cancel|stop)\b/i.test(t.trim());
}

/* who should reply (when not in a pending permission step) */
function decideResponder(text, lastResponder) {
  const s = text.toLowerCase().trim();

  if (/^(hi|hello|hey|salam|salaam)\b/.test(s)) return "A";
  if (/\b(my name is|i['’]?\s*m|i am)\b/.test(s)) return "A";

  if (
    /\b(take me( there)?|go( there)?|navigate|where is|how do i get|back to)\b/.test(
      s
    )
  )
    return "A";
  if (pickRoomByText(s)) return "A";

  if (
    /\b(tell me about|describe|who painted|when was|style|meaning|analysis|context|history|show me)\b/.test(
      s
    )
  )
    return "B";
  if (pickArtworkByText(s)) return "B";

  return lastResponder === "A" ? "B" : "A";
}

/* backend call */
async function askAgent({ role, message, currentRoom, history, lastArtwork }) {
  const res = await fetch("http://localhost:3001/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, message, currentRoom, history, lastArtwork }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data; // { reply, suggestedRoom, suggestedArtwork }
}

/* ===== Component ===== */
export default function App({ initialName = "" }) {
  const [userName, setUserName] = useState(initialName);
  const [room, setRoom] = useState("entrance");
  const [imageSrc, setImageSrc] = useState(ROOM_MAP[room]);

  // permission state machine
  // idle → awaitingRoomConfirm → awaitingArtworkConfirm
  const [pendingStep, setPendingStep] = useState("idle"); // 'idle' | 'awaitRoomConfirm' | 'awaitArtworkConfirm'
  const [pendingArtworkKey, setPendingArtworkKey] = useState(null); // e.g., 'mona lisa'
  const [pendingRoom, setPendingRoom] = useState(null); // e.g., 'classic'

  const initialMessages = useMemo(() => {
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
  }, [initialName]);

  const [messages, setMessages] = useState(() => initialMessages);
  const [isTypingA, setTypingA] = useState(false);
  const [isTypingB, setTypingB] = useState(false);
  const [lastResponder, setLastResponder] = useState("B");
  const [lastArtworkKey, setLastArtworkKey] = useState(null);
  const [lastSuggestedRoom, setLastSuggestedRoom] = useState(null);

  useEffect(() => {
    setImageSrc(ROOM_MAP[room] || ROOM_MAP.entrance);
  }, [room]);

  const typeThenReply = async (agent, textPromise, delay = 550) => {
    const setTyping = agent === "A" ? setTypingA : setTypingB;
    const who = agent === "A" ? AGENT_A : AGENT_B;

    setTyping(true);
    try {
      await new Promise((r) => setTimeout(r, delay));
      const { reply, suggestedRoom, suggestedArtwork } = await textPromise;

      // we do NOT auto-navigate or auto-show during permission steps
      if (pendingStep === "idle") {
        if (suggestedRoom) {
          setRoom(suggestedRoom);
          setLastSuggestedRoom(suggestedRoom);
        }
        if (suggestedArtwork?.image) {
          setImageSrc(suggestedArtwork.image);
          if (suggestedArtwork.key)
            setLastArtworkKey(suggestedArtwork.key.toLowerCase());
        }
      }

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
  };

  // helper wrappers for agent A/B
  const sayA = (message, delay = 420) =>
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

  const sayB = (message, delay = 520) =>
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
    // user bubble
    setMessages((prev) => [...prev, { ...USER, text }]);

    /* ===== permission steps take precedence ===== */
    if (pendingStep === "awaitRoomConfirm") {
      if (isAffirmative(text)) {
        // move to the room
        if (pendingRoom) setRoom(pendingRoom);
        setPendingStep("awaitArtworkConfirm");

        // Ask permission to show the specific artwork
        await sayA(
          `We are in the ${pendingRoom} room now. Ask (one short question) if the visitor wants to see "${pendingArtworkKey}".`
        );
        return;
      }
      if (isNegative(text)) {
        // cancel
        setPendingStep("idle");
        setPendingArtworkKey(null);
        setPendingRoom(null);
        await sayA("No problem. What would you like to explore instead?");
        return;
      }
      // if user typed something else while we wait, gently re-ask
      await sayA(
        `Would you like me to take you to the ${pendingRoom} room to see "${pendingArtworkKey}"?`
      );
      return;
    }

    if (pendingStep === "awaitArtworkConfirm") {
      if (isAffirmative(text)) {
        // show the artwork image
        const art = ARTWORK_MAP[pendingArtworkKey];
        if (art?.image) setImageSrc(art.image);
        setLastArtworkKey(pendingArtworkKey);

        // done with the flow
        setPendingStep("idle");
        const shownKey = pendingArtworkKey;
        setPendingArtworkKey(null);
        setPendingRoom(null);

        // Now Agent B gives the info (only AFTER showing)
        await sayB(
          `Give a concise (1–2 sentence) description of "${shownKey}". Do not include navigation details.`
        );
        return;
      }
      if (isNegative(text)) {
        setPendingStep("idle");
        const cancelledRoom = pendingRoom;
        setPendingArtworkKey(null);
        setPendingRoom(null);
        await sayA(
          `Okay. We're in the ${cancelledRoom} room. What would you like to see next?`
        );
        return;
      }
      await sayA(`Would you like me to show you "${pendingArtworkKey}" now?`);
      return;
    }

    /* ===== name capture (only when not in permission steps) ===== */
    if (!userName) {
      const m =
        text.match(
          /\b(i\s*am|i['’]?\s*m|my\s+name\s+is)\s+([A-Za-z][\w-]*)\b/i
        ) || (/^[A-Za-z][\w-]*$/.test(text.trim()) ? [, , text.trim()] : null);

      if (m) {
        const name = m[2];
        setUserName(name);
        const hist0 = buildHistory([...messages, { ...USER, text }]);

        typeThenReply(
          "A",
          askAgent({
            role: "agentA",
            message: `The visitor's name is ${name}. Greet them briefly.`,
            currentRoom: room,
            history: hist0,
            lastArtwork: lastArtworkKey,
          }),
          350
        );

        typeThenReply(
          "B",
          askAgent({
            role: "agentB",
            message:
              "Ask what they want to explore next (one short question). Do not greet; do not mention not greeting.",
            currentRoom: room,
            history: hist0,
            lastArtwork: lastArtworkKey,
          }),
          600
        );
        return;
      }
    }

    /* ===== detect direct artwork request → start permission flow ===== */
    const artKey = pickArtworkByText(text);
    if (artKey && ARTWORK_MAP[artKey]) {
      const { room: artRoom } = ARTWORK_MAP[artKey];
      setPendingArtworkKey(artKey);
      setPendingRoom(artRoom);
      setPendingStep("awaitRoomConfirm");

      // Ask permission to navigate first (no info yet, no image yet)
      await sayA(
        `The visitor asked for "${artKey}". Ask (one short question) for permission to go to the ${artRoom} room.`
      );
      return;
    }

    /* ===== plain room routing (no pending flow) ===== */
    const target = pickRoomByText(text);
    if (target) setRoom(target);

    /* ===== default responder ===== */
    const responder = decideResponder(text, lastResponder);
    const role = responder === "A" ? "agentA" : "agentB";
    const hist = buildHistory([...messages, { ...USER, text }]);

    typeThenReply(
      responder,
      askAgent({
        role,
        message: text,
        currentRoom: room,
        history: hist,
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
