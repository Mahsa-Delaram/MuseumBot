import React, { useEffect, useState } from "react";
import Gallery from "./components/Gallery";
import ChatPanel from "./components/ChatPanel";
import "./app.css";

/* avatars */
const AGENT_A = { role: "agentA", avatar: "/images/agentA.png" };
const AGENT_B = { role: "agentB", avatar: "/images/agentB.png" };
const USER = { role: "user", avatar: "/images/user.png" };

/* room images */
const ROOM_MAP = {
  entrance: "/images/entrance.jpg",
  modern: "/images/modern.jpg",
  classic: "/images/classic.jpg",
  sculpture: "/images/sculpture.jpg",
  landscape: "/images/landscape.jpg",
};

/* artwork images — keys LOWERCASE, match museum.json keys */
const ARTWORK_MAP = {
  "mona lisa": { image: "/images/mona_lisa.jpg", room: "classic" },
  "the last supper": { image: "/images/the_last_supper.jpg", room: "classic" },
  "girl with a pearl earring": {
    image: "/images/girl_with_pearl.jpg",
    room: "classic",
  },
  "birth of venus": { image: "/images/birth_of_venus.jpg", room: "classic" },
  "the night watch": { image: "/images/the_night_watch.jpg", room: "classic" },

  "starry night": { image: "/images/starry_night.jpg", room: "modern" },
  "the scream": { image: "/images/the_scream.jpg", room: "modern" },
  guernica: { image: "/images/guernica.jpg", room: "modern" },
  "the persistence of memory": {
    image: "/images/the_persistence_of_memory.jpg",
    room: "modern",
  },
  "the kiss": { image: "/images/the_kiss.jpg", room: "modern" },
  "american gothic": { image: "/images/american_gothic.jpg", room: "modern" },

  "water lilies": { image: "/images/water_lilies.jpg", room: "landscape" },
};

/* ---- helpers ---- */
function pickRoomByText(t) {
  const s = t.toLowerCase();
  if (/(modern|abstract|contemporary)/.test(s)) return "modern";
  if (/(classic|renaissance|baroque|old)/.test(s)) return "classic";
  if (/(sculpt|statue|3d)/.test(s)) return "sculpture";
  if (/(landscape|nature)/.test(s)) return "landscape";
  if (/(entrance|lobby|main hall|home)/.test(s)) return "entrance";
  return null;
}

function pickArtworkByText(t) {
  const s = t.toLowerCase();
  return Object.keys(ARTWORK_MAP).find((k) => s.includes(k)) || null;
}

/* decide responder */
function decideResponder(text, lastResponder) {
  const s = text.toLowerCase().trim();

  // confirmations → Agent A (navigation)
  if (
    /^(y(es)?|yeah|sure|ok(ay)?|please do|go ahead|take me|let's go)\b/.test(s)
  )
    return "A";

  // greetings / name → Agent A
  if (/^(hi|hello|hey|salam|salaam)\b/.test(s)) return "A";
  if (/\b(my name is|i['’]?\s*m|i am)\b/.test(s)) return "A";

  // navigation intent → Agent A
  if (
    /\b(show me( then)?|take me( there)?|go( there)?|navigate|where is|how do i get|back to)\b/.test(
      s
    )
  )
    return "A";
  if (pickRoomByText(s)) return "A";

  // artwork info → Agent B
  if (
    /\b(tell me about|describe|who painted|when was|style|meaning|analysis|context|history|show me)\b/.test(
      s
    )
  )
    return "B";
  if (pickArtworkByText(s)) return "B";

  // ambiguous → alternate
  return lastResponder === "A" ? "B" : "A";
}

/* compact history */
function buildHistory(list) {
  return list
    .slice(-8)
    .map((m) => {
      const who =
        m.role === "user" ? "User" : m.role === "agentA" ? "AgentA" : "AgentB";
      return `${who}: ${m.text}`;
    })
    .join("\n");
}

/* backend call */
async function askAgent(role, message, currentRoom, history, lastArtwork) {
  const res = await fetch("http://localhost:3001/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, message, currentRoom, history, lastArtwork }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data; // { reply, suggestedRoom, suggestedArtwork? }
}

export default function App() {
  const [userName, setUserName] = useState("");
  const [room, setRoom] = useState("entrance");
  const [imageSrc, setImageSrc] = useState(ROOM_MAP[room]);

  const [messages, setMessages] = useState(() => [
    {
      ...AGENT_A,
      text: "Hi! Welcome to the museum. I’m Agent A (tourist guide).",
    },
    {
      ...AGENT_B,
      text: "Hello! I’m Agent B (art guide). Ask me about any masterpiece.",
    },
  ]);

  const [isTypingA, setTypingA] = useState(false);
  const [isTypingB, setTypingB] = useState(false);
  const [lastResponder, setLastResponder] = useState("B");
  const [lastArtworkKey, setLastArtworkKey] = useState(null);
  const [lastSuggestedRoom, setLastSuggestedRoom] = useState(null);

  useEffect(() => {
    setImageSrc(ROOM_MAP[room] || ROOM_MAP.entrance);
  }, [room]);

  const typeThenReply = async (agent, textPromise, delay = 600) => {
    const setTyping = agent === "A" ? setTypingA : setTypingB;
    const who = agent === "A" ? AGENT_A : AGENT_B;

    setTyping(true);
    try {
      await new Promise((r) => setTimeout(r, delay));
      const { reply, suggestedRoom, suggestedArtwork } = await textPromise;

      if (suggestedRoom) {
        setRoom(suggestedRoom);
        setLastSuggestedRoom(suggestedRoom);
      }
      if (suggestedArtwork?.image) {
        setImageSrc(suggestedArtwork.image);
        if (suggestedArtwork.key)
          setLastArtworkKey(suggestedArtwork.key.toLowerCase());
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

  const onSend = async (text) => {
    // user bubble
    setMessages((prev) => [...prev, { ...USER, text }]);

    // name capture
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
          askAgent(
            "agentA",
            `The visitor's name is ${name}. Greet them briefly.`,
            room,
            hist0,
            lastArtworkKey
          ),
          350
        );
        typeThenReply(
          "B",
          askAgent(
            "agentB",
            `The visitor is ${name}. Ask what they want to explore (one short question). 
   Do not greet; do not mention not greeting.`,
            room,
            hist,
            lastArtworkKey
          ),
          600
        );
        return;
      }
    }

    // confirmation intent → if we have a lastSuggestedRoom, navigate immediately
    if (
      /^(y(es)?|yeah|sure|ok(ay)?|please do|go ahead|let's go)\b/i.test(
        text.trim()
      )
    ) {
      if (lastSuggestedRoom) {
        setRoom(lastSuggestedRoom);
      }
      const hist1 = buildHistory([...messages, { ...USER, text }]);
      // Ask Agent A to acknowledge move briefly (no re-greeting)
      typeThenReply(
        "A",
        askAgent(
          "agentA",
          `The visitor just confirmed. Acknowledge and briefly guide them in the ${
            lastSuggestedRoom || room
          } room. Do not greet again.`,
          room,
          hist1,
          lastArtworkKey
        ),

        420
      );
      return;
    }

    // instant artwork switch (no wait)
    const artKey = pickArtworkByText(text);
    if (artKey && ARTWORK_MAP[artKey]) {
      const { image, room: artRoom } = ARTWORK_MAP[artKey];
      if (artRoom) setRoom(artRoom);
      if (image) setImageSrc(image);
      setLastArtworkKey(artKey);
    }

    // local room routing (immediate)
    const target = pickRoomByText(text);
    if (target) setRoom(target);

    // decide responder; send history + lastArtwork
    const responder = decideResponder(text, lastResponder);
    const role = responder === "A" ? "agentA" : "agentB";
    const hist = buildHistory([...messages, { ...USER, text }]);

    typeThenReply(
      responder,
      askAgent(role, text, room, hist, lastArtworkKey),
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
