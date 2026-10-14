import { Metadata } from "next";

import { PondGame } from "@/components/wind-game/pond-game";

export const metadata: Metadata = {
  title: "frog pond",
  description:
    "A tiny wind-physics game: steer the air with walls, fans and drains to get the frog to the lotus.",
};

export default function PondPage() {
  return (
    <div className="relative h-[100svh] overflow-hidden bg-black">
      <PondGame />
    </div>
  );
}
