import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { FieldError } from "@namera-ai/ui/field";
import { expect, it } from "vitest";

it("renders resolver errors without a React Aria validation context", () => {
  const html = renderToStaticMarkup(
    createElement(FieldError, { errors: [undefined, { message: "Message types must be unique" }] }),
  );
  expect(html).toContain("Message types must be unique");
  expect(html).toContain('role="alert"');
});

it("renders explicit errors and omits empty error output", () => {
  expect(renderToStaticMarkup(createElement(FieldError, null, "Invalid address"))).toContain(
    "Invalid address",
  );
  expect(renderToStaticMarkup(createElement(FieldError, { errors: [undefined] }))).toBe("");
});
