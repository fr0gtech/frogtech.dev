import NextLink from "next/link";

import { FluidHero } from "@/components/fluid-hero";
import { GithubIcon } from "@/components/icons";

type Project = {
  name: string;
  href: string;
  description: string;
  isNew?: boolean;
  hidden?: boolean;
  repos?: { label: string; href: string }[];
};

const projects: Project[] = [
  {
    name: "windbender.io",
    href: "https://windbender.io",
    description: "A physics based sailing webGPU online game.",
    isNew: true,
    hidden: true, // servers are down for now
  },
  {
    name: "mods.frogtech.dev",
    href: "https://mods.frogtech.dev",
    description: "Our Deadlock mods: HUD editor, 4:3 stretched fix and more",
  },
  {
    name: "twitchdictionary.com",
    href: "https://twitchdictionary.com",
    description: "Every Twitch emote, defined by how chat really uses it",
  },
  {
    name: "sub-sunday.com",
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
    name: "vod.ing",
    href: "https://vod.ing",
    description: "Next gen stream editing in the browser",
    repos: [{ label: "vodingdot", href: "https://github.com/vodingdot" }],
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

      <section
        className="w-full bg-[var(--frog-bg,#000)] px-6 py-24 md:px-16"
        id="projects"
      >
        <ul className="border-t border-white/10">
          {projects
            .filter((p) => !p.hidden)
            .map((p) => {
              const repos =
                p.repos ??
                (p.href.startsWith("https://github.com")
                  ? [{ label: "github", href: p.href }]
                  : []);

              return (
                <li
                  key={p.name}
                  className="group relative grid gap-2 border-b border-white/10 py-7 md:grid-cols-[minmax(0,5fr)_minmax(0,5fr)_minmax(0,3fr)] md:items-center md:gap-10"
                >
                  <NextLink
                    className="flex items-center gap-3 text-2xl font-bold text-white transition-colors group-hover:text-emerald-300 lg:text-3xl"
                    href={p.href}
                  >
                    <span className="break-words">{p.name}</span>
                    {p.isNew && (
                      <span className="text-xs font-normal text-red-500">
                        NEW
                      </span>
                    )}
                    <span className="hidden -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 md:inline">
                      →
                    </span>
                  </NextLink>
                  <p className="text-sm text-white/50 md:text-base">
                    {p.description}
                  </p>
                  <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
                    {repos.map((r) => (
                      <a
                        key={r.href}
                        className="flex items-center gap-2 text-white/40 transition-colors hover:text-white"
                        href={r.href}
                      >
                        <GithubIcon size={16} />
                        {r.label}
                      </a>
                    ))}
                  </div>
                </li>
              );
            })}
        </ul>
      </section>
    </>
  );
}
