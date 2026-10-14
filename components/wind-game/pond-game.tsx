"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { WindGame } from "@/components/wind-game/wind-game";

export function PondGame() {
  const router = useRouter();
  // /pond?embed: running inside another site's frame (itch.io), so there's
  // no "exit to frogtech.dev"
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    setEmbedded(new URLSearchParams(window.location.search).has("embed"));
  }, []);

  return <WindGame onExit={embedded ? undefined : () => router.push("/")} />;
}
