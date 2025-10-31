import React, { useEffect, useRef, useState } from "react";
import "../app.css";

export default function ChatPanel({
  messages = [],
  onSend,
  isTypingA = false,
  isTypingB = false,
}) {
  const [text, setText] = useState("");

  const endRef = useRef(null);

  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages, isTypingA, isTypingB]);

  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    onSend?.(t);
    setText("");
  };

  const Avatar = ({ src }) => (
    <span className="avatar">
      <img
        src={src}
        alt=""
        width="28"
        height="28"
        loading="eager"
        decoding="sync"
      />
    </span>
  );
  const avatarA =
    messages.find((m) => m.role === "agentA")?.avatar || "/images/agentA.png";
  const avatarB =
    messages.find((m) => m.role === "agentB")?.avatar || "/images/agentB.png";

  return (
    <div className="chat">
      <header className="chat__header">
        <h2>Gallery Assistants</h2>
      </header>

      <div className="chat__messages">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`message-row ${m.role === "user" ? "user" : "agent"}`}
          >
            {m.role !== "user" && <Avatar src={m.avatar} />}
            <div className={`bubble bubble--${m.role}`}>{m.text}</div>
            {m.role === "user" && <Avatar src={m.avatar} />}
          </div>
        ))}

        {/* Typing indicators */}
        {isTypingA && (
          <div className="message-row agent">
            <Avatar src={avatarA} />
            <div className="bubble bubble--agentA typing">
              <span className="dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}
        {isTypingB && (
          <div className="message-row agent">
            <Avatar src={avatarB} />
            <div className="bubble bubble--agentB typing">
              <span className="dots">
                <span></span>
                <span></span>
                <span></span>
              </span>
            </div>
          </div>
        )}

        {/* Invisible anchor to auto-scroll to */}
        <div ref={endRef} />
      </div>

      <form className="chat__input" onSubmit={submit}>
        <input
          placeholder="Write here…"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
