import { Column, Img, Row, Text } from "react-email";

import { emailAssets } from "../data.js";

// Match the wordmark's visible letter height, rather than its full line box.
const logoStyle = { width: 20, height: "auto" } as const;

export const NameraBrand = () => {
  return (
    <Row>
      <Column className="w-7 align-middle">
        <Img
          alt=""
          className="block dark:hidden"
          height="16.5625"
          src={emailAssets.brand.light}
          style={logoStyle}
          width="20"
        />
        <Img
          alt=""
          className="hidden dark:block"
          height="16.5625"
          src={emailAssets.brand.dark}
          style={logoStyle}
          width="20"
        />
      </Column>
      <Column className="align-middle">
        <Text className="m-0 text-xl font-semibold tracking-[-0.2px] text-email-light-foreground dark:text-email-dark-foreground">
          Namera
        </Text>
      </Column>
    </Row>
  );
};
