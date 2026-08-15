import { Column, Img, Row, Text } from "react-email";

import { emailAssets } from "../data.js";

export const NameraBrand = () => {
  return (
    <Row>
      <Column className="w-7.5 align-middle">
        <Img
          alt=""
          className="block dark:hidden"
          height="30"
          src={emailAssets.brand.light}
          width="25"
        />
        <Img
          alt=""
          className="hidden dark:block"
          height="30"
          src={emailAssets.brand.dark}
          width="25"
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
