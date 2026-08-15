import { Column, Img, Row, Text } from "react-email";

import { emailAssets } from "../data.js";

export const NameraBrand = () => {
  return (
    <Row>
      <Column className="w-7.5 align-middle">
        <Img
          alt=""
          className="block dark:hidden"
          height="15"
          src={emailAssets.brand.light}
          width="20"
        />
        <Img
          alt=""
          className="hidden dark:block"
          height="15"
          src={emailAssets.brand.dark}
          width="20"
        />
      </Column>
      <Column className="align-middle">
        <Text className="m-0 pl-3 text-xl font-semibold tracking-[-0.2px] text-email-light-foreground dark:text-email-dark-foreground">
          Namera
        </Text>
      </Column>
    </Row>
  );
};
