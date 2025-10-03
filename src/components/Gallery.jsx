import React from "react";

export default function Gallery({ src = "/images/entrance.jpg", alt = "Gallery view" }) {
  return (
    <div className="gallery">
      <img src={src} alt={alt} />
    </div>
  );
}
