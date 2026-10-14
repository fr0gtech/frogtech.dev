"use client";

import { useEffect, useRef, useState } from "react";
import NextLink from "next/link";
import clsx from "clsx";

import { GithubIcon } from "@/components/icons";
import { FluidPanel, isTuning } from "@/components/fluid-panel";
import { FluidSettings, MINI_DEFAULTS } from "@/components/fluid-settings";
import { LogoKey, ProjectLogo } from "@/components/project-logo";

export type Project = {
  name: string;
  href: string;
  description: string;
  logo?: LogoKey;
  isNew?: boolean;
  hidden?: boolean;
  repos?: { label: string; href: string }[];
};

export function ProjectRow({
  p,
  small,
  settings,
}: {
  p: Project;
  small?: boolean;
  settings: FluidSettings;
}) {
  const repos = p.repos ?? [];
  const rowRef = useRef<HTMLLIElement>(null);
  // column 2+ content shifts right of the logo on mobile
  const col = p.logo ? "col-start-2 md:col-start-auto" : "";

  return (
    <li
      ref={rowRef}
      className={clsx(
        "group relative grid gap-2 border-b border-white/10 md:items-center md:gap-10",
        p.logo
          ? "grid-cols-[56px_minmax(0,1fr)] gap-x-5 md:grid-cols-[72px_minmax(0,5fr)_minmax(0,5fr)_minmax(0,3fr)]"
          : "md:grid-cols-[minmax(0,5fr)_minmax(0,5fr)_minmax(0,3fr)]",
        small ? "py-4" : "py-7",
      )}
    >
      {p.logo && (
        <ProjectLogo
          className="row-span-3 aspect-square w-full self-start md:row-span-1 md:self-center"
          interactRef={rowRef}
          logo={p.logo}
          settings={settings}
        />
      )}
      {/* the whole row is the link; repo links sit above it */}
      <NextLink
        className={clsx(
          col,
          "flex items-center gap-3 font-bold text-white transition-colors after:absolute after:inset-0 group-hover:text-emerald-300",
          small ? "text-lg lg:text-xl" : "text-2xl lg:text-3xl",
        )}
        href={p.href}
      >
        <span className="break-words">{p.name}</span>
        {p.isNew && (
          <span className="text-xs font-normal text-red-500">NEW</span>
        )}
        <span className="hidden -translate-x-2 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 md:inline">
          →
        </span>
      </NextLink>
      <p className={clsx(col, "text-sm text-white/50 md:text-base")}>
        {p.description}
      </p>
      <div
        className={clsx(
          col,
          "relative z-10 flex flex-wrap gap-x-5 gap-y-1 text-sm",
        )}
      >
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
}

// projects with a logo are live sites and go on top, the rest are repos
export function ProjectList({ projects }: { projects: Project[] }) {
  const [settings, setSettings] = useState(MINI_DEFAULTS);
  const [tuning, setTuning] = useState(false);

  useEffect(() => setTuning(isTuning()), []);

  return (
    <section
      className="w-full bg-[var(--frog-bg,#000)] px-6 py-24 md:px-16"
      id="projects"
    >
      <ul className="border-t border-white/10">
        {projects
          .filter((p) => p.logo)
          .map((p) => (
            <ProjectRow key={p.name} p={p} settings={settings} />
          ))}
      </ul>

      <h2 className="mb-4 mt-20 flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-white/40">
        <GithubIcon size={14} /> on github
      </h2>
      <ul className="border-t border-white/10">
        {projects
          .filter((p) => !p.logo)
          .map((p) => (
            <ProjectRow key={p.name} small p={p} settings={settings} />
          ))}
      </ul>

      {tuning && (
        <FluidPanel
          showLogoColors
          className="fixed bottom-4 right-4"
          defaults={MINI_DEFAULTS}
          presets={false}
          settings={settings}
          storageKey="frogtech-logo-settings"
          title="tune logos"
          onChange={setSettings}
        />
      )}
    </section>
  );
}
