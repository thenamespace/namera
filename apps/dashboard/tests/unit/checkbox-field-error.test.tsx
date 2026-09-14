import { renderToStaticMarkup } from "react-dom/server";

import { Checkbox, FieldError, Modal } from "@namera-ai/ui";
import { describe, expect, it } from "vitest";

const errors = [{ message: "Acknowledgement is required." }];

describe("checkbox validation feedback", () => {
  it("renders an explicit form error inside a modal without inheriting its description slot", () => {
    const markup = renderToStaticMarkup(
      <Modal.Dialog aria-label="Policy editor">
        <FieldError errors={errors} />
      </Modal.Dialog>,
    );
    expect(markup).toContain("Acknowledgement is required.");
    expect(markup).toContain('role="alert"');
  });
  it("renders resolver errors inside a checkbox without crashing", () => {
    const markup = renderToStaticMarkup(
      <Checkbox isInvalid isSelected={false}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          Acknowledge recovery limitations
        </Checkbox.Content>
        <FieldError errors={errors} />
      </Checkbox>,
    );

    expect(markup).toContain("Acknowledgement is required.");
    expect(markup).toContain('role="alert"');
  });
});
