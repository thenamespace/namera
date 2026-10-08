import { Img, Link, Section } from "react-email";

import { emailAssets, emailLinks } from "../data.js";

type SocialIconProps = {
  readonly alt: string;
  readonly dark: string;
  readonly light: string;
  readonly size?: number;
};

const SocialIcon = ({ alt, dark, light, size = 18 }: SocialIconProps) => (
  <>
    <Img alt={alt} className="block dark:hidden" height={size} src={light} width={size} />
    <Img alt={alt} className="hidden dark:block" height={size} src={dark} width={size} />
  </>
);

export const EmailSocialLinks = () => {
  return (
    <Section className="mb-5 text-center">
      <Link
        aria-label={emailLinks.website.label}
        className="mx-2 inline-block"
        href={emailLinks.website.href}
      >
        <SocialIcon alt={emailLinks.website.label} {...emailAssets.social.website} />
      </Link>
      <Link
        aria-label={emailLinks.github.label}
        className="mx-2 inline-block"
        href={emailLinks.github.href}
      >
        <SocialIcon alt={emailLinks.github.label} {...emailAssets.social.github} />
      </Link>
      <Link aria-label={emailLinks.x.label} className="mx-2 inline-block" href={emailLinks.x.href}>
        <SocialIcon alt={emailLinks.x.label} {...emailAssets.social.x} size={14} />
      </Link>
      <Link
        aria-label={emailLinks.email.label}
        className="mx-2 inline-block"
        href={emailLinks.email.href}
      >
        <SocialIcon alt={emailLinks.email.label} {...emailAssets.social.email} />
      </Link>
      <Link
        aria-label={emailLinks.linkedin.label}
        className="mx-2 inline-block"
        href={emailLinks.linkedin.href}
      >
        <SocialIcon alt={emailLinks.linkedin.label} {...emailAssets.social.linkedin} />
      </Link>
    </Section>
  );
};
