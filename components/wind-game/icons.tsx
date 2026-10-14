import { ToolOrErase } from "@/components/wind-game/rules";

// Hotbar / HUD icons, drawn to match the pieces on the board.

const common = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  strokeWidth: 2,
  viewBox: "0 0 24 24",
};

export function ToolIcon({
  tool,
  className,
}: {
  tool: ToolOrErase;
  className?: string;
}) {
  switch (tool) {
    case "wall":
      return (
        <svg {...common} className={className}>
          <rect height="16" rx="1" width="16" x="4" y="4" />
          <path d="M4 9.5h16M4 14.5h16M10 4v5.5M15 9.5v5M9 14.5V20" />
        </svg>
      );
    case "fan":
      return (
        <svg {...common} className={className}>
          <rect height="16" rx="3" width="16" x="4" y="4" />
          <path d="M12 12c0-3 1.5-4.5 3.5-4.5M12 12c3 0 4.5 1.5 4.5 3.5M12 12c0 3-1.5 4.5-3.5 4.5M12 12c-3 0-4.5-1.5-4.5-3.5" />
          <path d="M21 12l2-1.5v3z" fill="currentColor" />
        </svg>
      );
    case "inflow":
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="12" fill="currentColor" r="5" />
          <circle cx="12" cy="12" opacity="0.5" r="8.5" />
          <path d="M19 12l3-2v4z" fill="currentColor" />
        </svg>
      );
    case "drain":
      return (
        <svg {...common} className={className}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" opacity="0.6" r="5.5" />
          <circle cx="12" cy="12" fill="currentColor" r="2" />
        </svg>
      );
    case "smoke":
      return (
        <svg {...common} className={className}>
          <path d="M7 18a3.5 3.5 0 0 1 .4-7 4.5 4.5 0 0 1 8.6-1 4 4 0 0 1 1.5 8z" />
          <path d="M4 21h2M9 21h2M14 21h2" opacity="0.6" />
        </svg>
      );
    case "erase":
      return (
        <svg {...common} className={className}>
          <path d="M8 20h12M5.5 14.5l8-8a2 2 0 0 1 2.8 0l2.2 2.2a2 2 0 0 1 0 2.8l-7 7H9.5l-4-4z" />
          <path d="M9.5 10.5l5 5" />
        </svg>
      );
  }
}

export type View = "speed" | "smoke" | "wind" | "both";

export function ViewIcon({
  view,
  className,
}: {
  view: View;
  className?: string;
}) {
  switch (view) {
    case "speed":
      return (
        <svg {...common} className={className}>
          <path d="M4 16a8 8 0 0 1 16 0" />
          <path d="M12 16l4-5" />
        </svg>
      );
    case "smoke":
      return (
        <svg {...common} className={className}>
          <path d="M6 17a4 4 0 0 1 .5-8 5 5 0 0 1 9.5-1 4.5 4.5 0 0 1 2 9z" />
        </svg>
      );
    case "wind":
      return (
        <svg {...common} className={className}>
          <path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7" />
        </svg>
      );
    case "both":
      return (
        <svg {...common} className={className}>
          <path d="M6 17a4 4 0 0 1 .5-8 5 5 0 0 1 9.5-1 4.5 4.5 0 0 1 2 9z" />
          <path d="M8 13h6M10 15.5h5" opacity="0.7" />
        </svg>
      );
  }
}
