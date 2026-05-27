import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "react-email";

import { nameraIcon, socials } from "./common";
import { nameraTwConfig, NameraFonts } from "./theme";

const baseUrl = "https://demo.react.email";

type ConfirmationEmailProps = {
  url: string;
};

export const ConfirmationEmail = ({ url }: ConfirmationEmailProps) => (
  <Tailwind config={nameraTwConfig}>
    <Html>
      <Head>
        <NameraFonts />
      </Head>
      <Body className="bg-background-2 font-14 m-0 p-0 font-sans">
        <Preview>Confirm your email address</Preview>
        <Container className="bg-background mx-auto max-w-160">
          <Section className="mobile:px-4 px-6 py-6">
            <Img
              src={nameraIcon}
              alt=""
              width="32"
              height="32"
              className="block"
            />
          </Section>

          <Section className="mobile:px-4 px-6">
            <Img
              src={`${baseUrl}/static/dither/dither-image-1.png`}
              alt=""
              width={592}
              className="block w-full max-w-148"
            />
          </Section>
          <Section className="mobile:px-4 mobile:py-10 px-6 py-14">
            <Section className="mobile:mb-8 mb-12">
              <Text className="font-56 mobile:font-40 text-foreground m-0 uppercase">
                almost there
              </Text>
              <Text className="font-14 text-primary-foreground m-0 mt-4.5 font-sans">
                Thank you for signing up for Namera.
              </Text>
              <Text className="font-14 text-primary-foreground m-0 font-sans">
                To verify your account, we just need to confirm your email.
              </Text>
              <Text className="font-13 text-muted-foreground m-0 mt-4.5 font-sans">
                If you didn&apos;t create an account, you can safely ignore this
                email.
              </Text>
            </Section>
            <Button
              href={url}
              className="bg-foreground font-15 text-bg text-background inline-block rounded-md px-5 py-3 text-center font-sans"
            >
              Confirm Email
            </Button>
          </Section>

          {/* Footer */}
          <Section className="mobile:px-4 mobile:py-12 border-border border-t px-6 py-16">
            <Text className="font-13 text-primary-foreground m-0 max-w-[320px] font-sans">
              Namera provides secure, programmable smart accounts for autonomous
              agents.
            </Text>
            <Row align="left">
              <Column className="w-full align-top">
                <Section align="left" className="mt-8 w-24">
                  <Row align="left">
                    <Column className="w-4 pr-2">
                      <Link href={socials.twitter} className="inline-block">
                        <Img
                          src={`${baseUrl}/static/shared/social-x-white.png`}
                          alt="X"
                          width="16"
                          height="16"
                          className="block"
                        />
                      </Link>
                    </Column>
                    <Column className="w-4 pr-2">
                      <Link href={socials.linkedin} className="inline-block">
                        <Img
                          src={`${baseUrl}/static/shared/social-li-white.png`}
                          alt="LinkedIn"
                          width="16"
                          height="16"
                          className="block"
                        />
                      </Link>
                    </Column>
                    <Column className="w-4">
                      <Link href={socials.github} className="inline-block">
                        <Img
                          src={`${baseUrl}/static/shared/social-gh-white.png`}
                          alt="GitHub"
                          width="16"
                          height="16"
                          className="block"
                        />
                      </Link>
                    </Column>
                  </Row>
                </Section>
              </Column>
            </Row>
            <Row align="left">
              <Column className="w-full pt-5 align-top">
                <Text className="font-11 text-primary-foreground m-0 max-w-40 font-sans">
                  <Link
                    href="https://example.com/"
                    className="text-primary-foreground"
                  >
                    Unsubscribe
                  </Link>{" "}
                  from Namera marketing emails.
                </Text>
              </Column>
            </Row>
          </Section>
        </Container>
      </Body>
    </Html>
  </Tailwind>
);

ConfirmationEmail.PreviewProps = {
  url: "https://example.com/",
} satisfies ConfirmationEmailProps;

export default ConfirmationEmail;
