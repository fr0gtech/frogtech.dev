import { IBM_Plex_Mono as FontMono, Inter as FontSans } from "next/font/google";

export const fontSans = FontMono({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-sans",
});

export const fontMono = FontSans({
  subsets: ["latin"],
  variable: "--font-mono",
});
