import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "../app.css";

export default function Intro({ onStart }) {
  const nav = useNavigate();
  const [name, setName] = useState("");

  // Preload key images for smooth transition
  useEffect(() => {
    const preload = [
      "/images/entrance.jpg",
      "/images/modern.jpg",
      "/images/classic.jpg",
    ];
    preload.forEach((src) => {
      const img = new Image();
      img.src = src;
    });
  }, []);

  // Handle Enter button
  const startMuseum = () => {
    const trimmed = name.trim();
    onStart?.(trimmed);
    nav("/museum");
  };

  return (
    <div className="intro">
      <div className="intro__card">
        <h1 className="intro__title">MuseumBot</h1>
        <p className="intro__subtitle">
          Step into a virtual museum where two AI guides will help you explore
          the world’s greatest masterpieces.
        </p>

        <label className="intro__label">
          Your name (optional)
          <input
            className="intro__input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mahsa"
          />
        </label>

        <div className="intro__buttons">
          <button className="intro__cta" onClick={startMuseum}>
            Enter the Museum
          </button>
          <button className="intro__ghost" onClick={() => nav("/museum")}>
            Continue as Guest
          </button>
        </div>
      </div>
    </div>
  );
}
