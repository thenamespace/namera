import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { SessionKeySelect } from "../../../src/components/session-key-select";

const emptyKeys: never[] = [];
const onChange = () => {};

describe("session key selector", () => {
  it("explains how to obtain an active key instead of presenting a dead dropdown", () => {
    const markup = renderToStaticMarkup(
      <SessionKeySelect
        aria-labelledby="session-keys"
        sessionKeys={emptyKeys}
        value={emptyKeys}
        onChange={onChange}
      />,
    );
    expect(markup).toContain("No active session keys.");
    expect(markup).toContain("approve a network");
    expect(markup).toContain("disabled");
    expect(markup).toContain("aria-describedby");
  });
});
