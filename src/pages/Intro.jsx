import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "../app.css";

export default function Intro({ onStart }) {
  const nav = useNavigate();
  const [name, setName] = useState("");
  const canEnter = name.trim().length > 0;

  useEffect(() => {
    [
      "/images/entrance.jpg",
      "/images/modern.jpg",
      "/images/classic.jpg",
    ].forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  const startWithName = () => {
    if (!canEnter) return;
    onStart?.(name.trim());
    nav("/museum");
  };

  const startAsGuest = () => {
    onStart?.("");
    nav("/museum");
  };

  return (
    <div className="intro">
      <div className="intro__card">
        <h1>MuseumBot</h1>
        <p>
          Step into a virtual museum where two AI guides help you explore the
          world’s greatest masterpieces.
        </p>

        <label className="intro__label" htmlFor="visitorName">
          Your name (optional)
        </label>
        <input
          id="visitorName"
          className="intro__input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mahsa"
        />

        <div className="intro__actions">
          <button
            className="intro__cta"
            onClick={startWithName}
            disabled={!canEnter}
            title={
              !canEnter
                ? "Enter a name to enable this button"
                : "Enter the museum"
            }
          >
            Enter the Museum
          </button>

          <button className="intro__ghost" onClick={startAsGuest}>
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
