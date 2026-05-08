"use client";

import { useEffect, useState } from "react";

export function AnimatedLoadingText({ text }: { text: string }) {
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const dotSequence = [".", "..", "..."];
    const interval = window.setInterval(() => {
      setDots(
        (current) =>
          dotSequence[(dotSequence.indexOf(current) + 1) % dotSequence.length],
      );
    }, 900);

    return () => window.clearInterval(interval);
  }, []);

  return (
    <span>
      {text}
      {dots}
    </span>
  );
}
