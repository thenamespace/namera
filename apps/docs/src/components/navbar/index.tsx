import { Link } from "@tanstack/react-router";

import { NameraIcon } from "@namera-ai/ui/icons";

import { Menu } from "./menu";

export const Navbar = () => {
  return (
    <nav className="w-full grow flex backdrop-blur-2xl z-100 fixed top-0 px-4 h-16 items-center justify-center bg-[linear-gradient(180deg,rgba(11,11,11,0.8)_0,color-mix(in_oklab,rgba(11,11,11,0.8)_100%,transparent_5%)_100%)] border-b border-white/10">
      {/* Subtle bottom glow accent */}
      <div
        aria-hidden={true}
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
        }}
      />
      <div className="max-w-7xl w-full flex justify-between items-center">
        <Link className="group flex flex-row items-center gap-2" to="/">
          <NameraIcon className="fill-foreground size-5 transition-transform group-hover:scale-110" />
          <span className="text-lg font-semibold tracking-tight">Namera</span>
        </Link>
        <Menu />
      </div>
    </nav>
  );
};
