"use client";

import { useRouter } from "next/navigation";

import { WindGame } from "@/components/wind-game/wind-game";

export function PondGame() {
  const router = useRouter();

  return <WindGame onExit={() => router.push("/")} />;
}
