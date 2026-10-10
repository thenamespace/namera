import { Img } from "react-email";

import { emailAssets } from "../data.js";

export function EmailCustody({
  custody,
  provider,
  label,
}: {
  readonly custody: "local" | "namera-managed";
  readonly provider?: "1claw" | undefined;
  readonly label?: string | undefined;
}) {
  const name =
    label ??
    (custody === "local"
      ? "User Owned"
      : provider === "1claw"
        ? "1Claw Managed"
        : "Namera Managed");
  const icon = provider === "1claw" ? emailAssets.oneclaw : emailAssets.brand;
  return (
    <>
      {custody === "namera-managed" ? (
        <>
          <Img
            alt=""
            src={icon.light}
            width="16"
            height="16"
            className="mr-2 inline-block align-middle dark:hidden"
          />
          <Img
            alt=""
            src={icon.dark}
            width="16"
            height="16"
            className="mr-2 hidden align-middle dark:inline-block"
          />
        </>
      ) : null}
      {name}
    </>
  );
}
