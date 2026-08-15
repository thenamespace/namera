import type { SVGProps } from "react";

import { Link, Section } from "react-email";

import { emailLinks } from "../data.js";

const iconProps = {
  "aria-hidden": true,
  fill: "none",
  height: 18,
  viewBox: "0 0 24 24",
  width: 18,
} as const satisfies SVGProps<SVGSVGElement>;

const WebsiteIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
    <path
      d="M3.5 12h17M12 3c2.2 2.45 3.3 5.45 3.3 9s-1.1 6.55-3.3 9c-2.2-2.45-3.3-5.45-3.3-9S9.8 5.45 12 3Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
  </svg>
);

const GitHubIcon = () => (
  <svg {...iconProps} fill="currentColor">
    <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.6 9.6 0 0 1 12 6.82a9.6 9.6 0 0 1 2.5.34c1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86v2.76c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
  </svg>
);

const EmailIcon = () => (
  <svg {...iconProps}>
    <rect height="15" rx="2" stroke="currentColor" strokeWidth="1.6" width="20" x="2" y="4.5" />
    <path d="m3 6 9 7 9-7" stroke="currentColor" strokeWidth="1.6" />
  </svg>
);

const LinkedInIcon = () => (
  <svg {...iconProps} fill="currentColor">
    <path d="M5.3 7.8H2.4V21h2.9V7.8ZM5.5 3.7A1.7 1.7 0 1 0 2.1 3.7a1.7 1.7 0 0 0 3.4 0ZM12.1 7.8H9.3V21h2.9v-6.5c0-1.7.3-3.4 2.5-3.4 2.1 0 2.2 2 2.2 3.5V21h2.9v-7.2c0-3.5-.8-6.2-4.9-6.2-2 0-3.3 1.1-3.8 2.1h-.1V7.8Z" />
  </svg>
);

export const EmailSocialLinks = () => {
  return (
    <Section className="mb-5 text-center text-email-light-muted dark:text-email-dark-muted">
      <Link
        aria-label={emailLinks.website.label}
        className="mx-2 inline-block text-email-light-muted dark:text-email-dark-muted"
        href={emailLinks.website.href}
      >
        <WebsiteIcon />
      </Link>
      <Link
        aria-label={emailLinks.github.label}
        className="mx-2 inline-block text-email-light-muted dark:text-email-dark-muted"
        href={emailLinks.github.href}
      >
        <GitHubIcon />
      </Link>
      <Link
        aria-label={emailLinks.email.label}
        className="mx-2 inline-block text-email-light-muted dark:text-email-dark-muted"
        href={emailLinks.email.href}
      >
        <EmailIcon />
      </Link>
      <Link
        aria-label={emailLinks.linkedin.label}
        className="mx-2 inline-block text-email-light-muted dark:text-email-dark-muted"
        href={emailLinks.linkedin.href}
      >
        <LinkedInIcon />
      </Link>
    </Section>
  );
};
