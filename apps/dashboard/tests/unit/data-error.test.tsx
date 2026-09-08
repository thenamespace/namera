import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { DataError } from "../../src/components/data-error";

const retry = () => {};

describe("query failure presentation", () => {
  it("announces the failed resource and offers local retry", () => {
    const markup = renderToStaticMarkup(<DataError compact label="account" onRetry={retry} />);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("Couldn’t load account");
    expect(markup).toContain("Try again");
    expect(markup).not.toContain("disabled");
  });

  it("disables repeated submissions while retrying", () => {
    const markup = renderToStaticMarkup(
      <DataError label="session key" onRetry={retry} isRetrying />,
    );
    expect(markup).toContain("Retrying…");
    expect(markup).toContain("disabled");
  });
});
