import React, { useMemo, useState } from "react";
import Gallery from "./components/Gallery";
import ChatPanel from "./components/ChatPanel";
import "./app.css";

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

function pickRoomByText(t) {
  const s = t.toLowerCase();
  if (/(modern|abstract|contemporary)/.test(s)) return "modern";
  if (/(classic|renaissance|baroque|old)/.test(s)) return "classic";
  if (/(sculpt|statue|3d)/.test(s)) return "sculpture";
  if (/(landscape|nature)/.test(s)) return "landscape";
  if (/(entrance|lobby|main hall|home)/.test(s)) return "entrance";
  if (/(go|show|take|where|room|gallery|hall)/.test(s)) return "entrance";
  return null;
}

export default function App() {
  const [userName, setUserName] = useState("");
  const [room, setRoom] = useState("entrance");
  const [messages, setMessages] = useState(() => [
    { ...AGENT_A, text: "Hi! Welcome to the museum. I’m Agent A." },
    { ...AGENT_B, text: "Hello! I’m Agent B. What’s your name?" },
  ]);

  // NEW: typing flags for each agent
  const [isTypingA, setTypingA] = useState(false);
  const [isTypingB, setTypingB] = useState(false);

  const imageSrc = useMemo(() => ROOM_MAP[room] || ROOM_MAP.entrance, [room]);

  // NEW: helper to show "typing…" then send the agent's message
  const replyFromAgent = (agent, text, delay = 700) => {
    const setTyping = agent === "A" ? setTypingA : setTypingB;
    const who = agent === "A" ? AGENT_A : AGENT_B;

    setTyping(true);
    window.setTimeout(() => {
      setMessages((prev) => [...prev, { ...who, text }]);
      setTyping(false);
    }, delay);
  };

  const onSend = (text) => {
    // 1) show user bubble immediately
    setMessages((prev) => [...prev, { ...USER, text }]);

    // 2) learn name (first time)
    if (!userName) {
      const m =
        text.match(
          /\b(i\s*am|i['’]?\s*m|my\s+name\s+is)\s+([A-Za-z][\w-]*)\b/i
        ) || (/^[A-Za-z][\w-]*$/.test(text.trim()) ? [, , text.trim()] : null);

      if (m) {
        const name = m[2];
        setUserName(name);
        replyFromAgent("A", `Nice to meet you, ${name}!`, 600);
        replyFromAgent(
          "B",
          "Tell us what you want to visit (e.g., modern room, classic hall, sculpture gallery).",
          900
        );
        return; // stop here
      }
    }

    // 3) route to room (Agent A confirms) or Agent B guides
    const target = pickRoomByText(text);
    if (target) {
      setRoom(target);
      const label = target.charAt(0).toUpperCase() + target.slice(1);
      replyFromAgent(
        "A",
        `Sure${
          userName ? `, ${userName}` : ""
        }. Taking you to the ${label} room…`,
        700
      );
    } else {
      replyFromAgent(
        "B",
        "I didn’t catch that. Try: “modern room”, “classic hall”, or “sculpture gallery.”",
        700
      );
    }
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
