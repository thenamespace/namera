import { Link } from "@tanstack/react-router";

import { NameraIcon } from "@namera-ai/ui/icons";
import {
  EnvelopeIcon,
  GithubLogoIcon,
  TelegramLogoIcon,
  XLogoIcon,
} from "@phosphor-icons/react";

const socials = [
  {
    href: "https://github.com/thenamespace/namera",
    icon: GithubLogoIcon,
    title: "Github",
  },
  {
    href: "https://twitter.com/namera_ai",
    icon: XLogoIcon,
    title: "Twitter",
  },
  {
    href: "mailto:hi@namera.ai",
    icon: EnvelopeIcon,
    title: "Discord",
  },
  {
    href: "https://t.me/namera_devs",
    icon: TelegramLogoIcon,
    title: "Telegram",
  },
];

export const Footer = () => {
  return (
    <>
      <div className="hidden md:flex">
        <FooterDesktop />
      </div>
      <div className="md:hidden flex">
        <FooterMobile />
      </div>
    </>
  );
};

export const FooterDesktop = () => {
  return (
    <footer className="w-full">
      <div className="max-w-6xl px-6 w-full mx-auto">
        <div className="flex flex-col">
          <div className="flex flex-row justify-between py-5 items-end border-y px-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-row gap-2 items-center">
                <NameraIcon className="size-6 fill-white" />
                <div className="text-white text-2xl font-medium">Namera</div>
              </div>
              <p className="text-[#939DB8] text-sm max-w-xs text-wrap">
                Secure, programmable smart accounts for autonomous agents.
              </p>
            </div>
            <div className="flex flex-row gap-4 items-center">
              <a
                className="text-neutral-200 text-sm font-light"
                href="mailto:hi@namera.ai"
                rel="noreferrer"
                target="_blank"
                title="Contact us"
              >
                hi@namera.ai
              </a>
              <div className="border-r border-neutral-400 h-4" />
              <div className="flex flex-row items-center gap-3">
                {socials.map((social) => (
                  <a
                    className="text-neutral-200 text-sm font-light"
                    href={social.href}
                    key={social.title}
                    rel="noreferrer"
                    target="_blank"
                    title={social.title}
                  >
                    <social.icon className="size-4.5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-row items-center justify-between border-border/50 py-3 px-3 text-neutral-300 ">
            <div className="flex flex-row gap-4 items-center text-xs">
              <Link to="/">Terms of Service</Link>
              <Link to="/">Privacy Policy</Link>
            </div>
            <div className="text-xs">© 2026 Namespace Inc.</div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export const FooterMobile = () => {
  return (
    <footer className="w-full border-t py-4 flex flex-col gap-4 items-center justify-center">
      <div className="flex flex-row gap-2 items-center">
        <NameraIcon className="size-5 fill-white" />
        <div className="text-white text-xl font-medium">Namera</div>
      </div>
      <div className="flex flex-row gap-4 items-center text-xs text-neutral-300">
        <Link to="/">Terms of Service</Link>
        <Link to="/">Privacy Policy</Link>
      </div>
      <div className="flex flex-col items-center justify-center gap-2">
        <div className="flex flex-row items-center gap-3">
          {socials.map((social) => (
            <a
              className="text-neutral-200 text-sm font-light"
              href={social.href}
              key={social.title}
              rel="noreferrer"
              target="_blank"
              title={social.title}
            >
              <social.icon className="size-4.5" />
            </a>
          ))}
        </div>
        <div className="text-xs text-neutral-300 ">© 2026 Namespace Inc.</div>
      </div>
    </footer>
  );
};
