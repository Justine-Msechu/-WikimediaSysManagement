import React, { useState, useEffect } from "react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const main = document.querySelector(".main-content");
    if (!main) return;
    const onScroll = () => setVisible(main.scrollTop > 300);
    main.addEventListener("scroll", onScroll, { passive: true });
    return () => main.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => document.querySelector(".main-content")?.scrollTo({ top: 0, behavior: "smooth" })}
      title="Back to top"
      style={{
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 1500,
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "#2d7a4f",
        color: "#fff",
        border: "none",
        fontSize: 18,
        cursor: "pointer",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "opacity 0.2s",
      }}
    >
      ↑
    </button>
  );
}
