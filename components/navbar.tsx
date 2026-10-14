"use client";

import NextLink from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import clsx from "clsx";

import { Logo } from "@/components/icons";

export const Navbar = () => {
  const isHome = usePathname() === "/";
  // on the home page the hero is the logo, so only show this once scrolled past it
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!isHome) return;
    const onScroll = () =>
      setScrolled(window.scrollY > window.innerHeight * 0.7);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => window.removeEventListener("scroll", onScroll);
  }, [isHome]);

  const visible = !isHome || scrolled;

  return (
    <header
      className={clsx(
        "fixed inset-x-0 top-0 z-20 flex h-16 items-center px-6 transition-all duration-500 ease-out",
        isHome && "bg-black/70 backdrop-blur",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-full opacity-0",
      )}
    >
      <NextLink className="flex justify-start items-center gap-1" href="/">
        <Logo className="mr-3" />
        <p className="font-bold text-inherit">Frogtech</p>
      </NextLink>
    </header>
  );
};
