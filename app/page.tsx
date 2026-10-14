import { FluidHero } from "@/components/fluid-hero";
import { Project, ProjectList } from "@/components/project-row";

const projects: Project[] = [
  {
    name: "frog pond",
    logo: "frog",
    href: "/pond",
    description:
      "A tiny wind-physics game. Steer the air, get the frog to the lotus.",
    isNew: true,
  },
  {
    name: "vod.ing",
    logo: "vod",
    href: "https://vod.ing",
    description: "Next gen stream editing in the browser",
    repos: [{ label: "vodingdot", href: "https://github.com/vodingdot" }],
  },
  {
    name: "twitchdictionary.com",
    logo: "twitchdictionary",
    href: "https://twitchdictionary.com",
    description: "Every Twitch emote, defined by how chat really uses it",
  },
  {
    name: "sub-sunday.com",
    logo: "subsunday",
    href: "https://sub-sunday.com",
    description: "Tracking votes for liriks subsunday",
    repos: [
      {
        label: "subsunday-front",
        href: "https://github.com/fr0gtech/subsunday-front",
      },
      {
        label: "subsunday-back",
        href: "https://github.com/fr0gtech/subsunday-back",
      },
    ],
  },
  {
    name: "fix-pink-youtube",
    href: "/fix-pink-youtube",
    description:
      "Fix the new red to pink gradient progress/scrubber bar in youtube",
    repos: [
      {
        label: "fix-pink-youtube",
        href: "https://github.com/greeb/fix-pink-youtube",
      },
    ],
  },
  {
    name: "mods.frogtech.dev",
    logo: "mods",
    href: "https://mods.frogtech.dev",
    description: "Our Deadlock mods: HUD editor, 4:3 stretched fix and more",
  },
  {
    name: "windbender.io",
    href: "https://windbender.io",
    description: "A physics based sailing webGPU online game.",
    isNew: true,
    hidden: true, // servers are down for now
  },
  {
    name: "spoty-stalk",
    href: "https://github.com/fr0gtech/spoty-stalk",
    description: "Stalk someones public spotify playlist and souncloud likes",
  },
  {
    name: "twitch-vod-chat-downloader",
    href: "https://github.com/fr0gtech/twitch-vod-chat-downloader",
    description: "Download chats from twitch",
  },
  {
    name: "frogbump",
    href: "https://github.com/fr0gtech/frogBump",
    description: "Random video player made in unity",
  },
];

export default function Home() {
  return (
    <>
      <FluidHero />
      <ProjectList projects={projects.filter((p) => !p.hidden)} />
    </>
  );
}
