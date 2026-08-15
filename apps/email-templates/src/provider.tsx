import type { PropsWithChildren } from "react";

import { Body, Head, Html, pixelBasedPreset, Preview, Tailwind } from "react-email";

import { NameraFonts } from "./fonts.js";
import { nameraTheme } from "./theme.js";

type NameraEmailProps = PropsWithChildren<{
  readonly preview: string;
}>;

export const NameraEmail = ({ children, preview }: NameraEmailProps) => {
  return (
    <Tailwind
      // oxlint-disable-next-line react-perf/jsx-no-new-object-as-prop
      config={{
        presets: [pixelBasedPreset],
        theme: nameraTheme,
      }}
    >
      <Html>
        <Head>
          <meta content="light dark" name="color-scheme" />
          <meta content="light dark" name="supported-color-schemes" />
          <NameraFonts />
        </Head>
        <Body className="m-0 bg-email-light-background font-sans text-email-light-foreground dark:bg-email-dark-background dark:text-email-dark-foreground">
          <Preview>{preview}</Preview>
          {children}
        </Body>
      </Html>
    </Tailwind>
  );
};
