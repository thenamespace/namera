import { Column, Row, Text } from "react-email";

export const NameraBrand = () => {
  return (
    <Row>
      <Column className="w-[30px] align-middle">
        <svg
          aria-hidden="true"
          className="block text-email-light-foreground dark:text-email-dark-foreground"
          fill="none"
          height="25"
          viewBox="0 0 180 149"
          width="30"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M52.9445 21.4688H0V42.6488H52.9445V21.4688Z" fill="currentColor" />
          <path
            d="M137.233 63.5289H158.413V0H52.5352V21.18H105.468V42.3489H52.5352V63.5289H105.468V84.709H52.5352V105.878H105.468V127.058H52.5352V148.238H158.413V84.709H137.233V63.5289Z"
            fill="currentColor"
          />
          <path d="M52.9445 63.8218H0V85.0018H52.9445V63.8218Z" fill="currentColor" />
          <path d="M52.9445 106.164H0V127.344H52.9445V106.164Z" fill="currentColor" />
          <path d="M180 63.8218H158.82V85.0018H180V63.8218Z" fill="currentColor" />
        </svg>
      </Column>
      <Column className="align-middle">
        <Text className="m-0 pl-3 text-base font-semibold tracking-[-0.2px] text-email-light-foreground dark:text-email-dark-foreground">
          Namera
        </Text>
      </Column>
    </Row>
  );
};
