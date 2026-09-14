import { Schema } from "effect";

export const LocalMcpApiOrigin = Schema.NonEmptyString.check(
  Schema.makeFilter(
    (value) => {
      const url = URL.parse(value);
      return (
        url !== null &&
        url.username === "" &&
        url.password === "" &&
        url.pathname === "/" &&
        url.search === "" &&
        url.hash === "" &&
        (url.protocol === "https:" ||
          (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
      );
    },
    {
      message:
        "Use an HTTPS API origin, or HTTP localhost for development, without credentials, path, query or fragment",
    },
  ),
);
