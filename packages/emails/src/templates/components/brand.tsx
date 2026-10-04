import { Column, Img, Row, Text } from "react-email";

import { emailAssets } from "../data.js";

const logoStyle = { width: 32, height: "auto" } as const;

export const NameraBrand = () => {
  return (
    <Row>
      <Column className="w-10 align-middle">
        <Img
          alt=""
          className="block dark:hidden"
          height="26.5"
          src={emailAssets.brand.light}
          style={logoStyle}
          width="32"
        />
        <Img
          alt=""
          className="hidden dark:block"
          height="26.5"
          src={emailAssets.brand.dark}
          style={logoStyle}
          width="32"
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
