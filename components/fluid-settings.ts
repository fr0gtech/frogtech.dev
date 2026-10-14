export type FluidSettings = {
  simRes: number;
  dyeRes: number;
  pixel: boolean;
  inflow: boolean;
  masked: boolean;
  curl: number;
  velocityDissipation: number;
  dyeDissipation: number;
  force: number;
  radius: number;
  inflowRate: number;
  colorA: string;
  colorB: string;
  colorSpeed: number;
  colorSpread: number;
  background: string;
  scrollInertia: number;
  logoColors: boolean;
};

export const PRESETS = {
  pixel: {
    simRes: 165,
    dyeRes: 199,
    pixel: true,
    inflow: true,
    masked: false,
    curl: 0,
    velocityDissipation: 5,
    dyeDissipation: 6,
    force: 2600,
    radius: 0.02,
    inflowRate: 80,
    colorA: "#ffffff",
    colorB: "#ffffff",
    colorSpeed: 0,
    colorSpread: 9.7,
    background: "#000000",
    scrollInertia: 0.1,
    logoColors: false,
  },
  smoke: {
    simRes: 128,
    dyeRes: 1024,
    pixel: false,
    inflow: true,
    masked: false,
    curl: 30,
    velocityDissipation: 0.5,
    dyeDissipation: 1.8,
    force: 5000,
    radius: 0.3,
    inflowRate: 12,
    colorA: "#4ce65a",
    colorB: "#b0f04a",
    colorSpeed: 0.4,
    colorSpread: 4,
    background: "#000000",
    scrollInertia: 0.4,
    logoColors: false,
  },
  mask: {
    simRes: 128,
    dyeRes: 1024,
    pixel: false,
    inflow: false,
    masked: true,
    curl: 28,
    velocityDissipation: 0.25,
    dyeDissipation: 0.9,
    force: 5000,
    radius: 0.3,
    inflowRate: 0,
    colorA: "#3cf0a0",
    colorB: "#4ce65a",
    colorSpeed: 0.4,
    colorSpread: 4,
    background: "#000000",
    scrollInertia: 0.4,
    logoColors: false,
  },
} satisfies Record<string, FluidSettings>;

export const DEFAULT_SETTINGS: FluidSettings = PRESETS.pixel;

// the little logo sims next to each project
export const MINI_DEFAULTS: FluidSettings = {
  ...DEFAULT_SETTINGS,
  simRes: 80,
  dyeRes: 41,
  radius: 0.8,
  force: 500,
  logoColors: true,
};
