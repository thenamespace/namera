import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";

import { RegistryContext } from "@effect/atom-react";
import { Layer, Schema } from "effect";
import { FetchHttpClient } from "effect/http";
import { AtomRegistry } from "effect/reactivity";

import { FeedbackView } from "@namera-ai/protocol/dto";
import { expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { useFeedback, useFeedbackDetail } from "../../src/hooks/feedback";
import { FeedbackStatusActions } from "../../src/routes/_authenticated/-components/feedback/status-actions";
import { adminRuntime } from "../../src/telemetry";
import { adminResponse } from "../fixtures/admin";
import { unexpectedRequests } from "./setup";

const id = "01900000-0000-7000-8000-000000000001";
const entry = Schema.decodeUnknownSync(FeedbackView)({
  id,
  userId: id,
  organizationId: null,
  category: "bug",
  status: "new",
  pagePath: "/identity",
  data: { version: 1, message: "Review dialog failed" },
  user: { email: "reporter@example.com", metadata: { version: 1, name: "Reporter" } },
  organization: null,
  createdAt: new Date("2026-10-01T00:00:00Z"),
  updatedAt: new Date("2026-10-01T00:00:00Z"),
});

function FeedbackScreen() {
  const list = useFeedback({});
  const detail = useFeedbackDetail(id);
  return (
    <>
      <output aria-label="List status">{list.data?.entries[0]?.status}</output>
      <output aria-label="Detail status">{detail.data?.status}</output>
      <FeedbackStatusActions entry={entry} />
    </>
  );
}

function json(body: unknown) {
  return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
}

it("updates only the selected feedback and refreshes its list and detail after success", async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let completed = false;
  const writes: unknown[] = [];
  const writePaths: string[] = [];
  const reads: string[] = [];
  adminRuntime.addGlobalLayer(
    Layer.succeed(FetchHttpClient.Fetch)(async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/internal/me" && init?.method === "GET")
        return json(adminResponse(["feedback:read", "feedback:manage"]));
      if (init?.method === "PATCH") {
        writePaths.push(path);
        if (path !== `/internal/feedback/${id}/status`) unexpectedRequests.push(`PATCH ${path}`);
        writes.push(JSON.parse(new TextDecoder().decode(init.body as Uint8Array)));
        await pending;
        completed = true;
        return json(
          Schema.encodeSync(Schema.toCodecJson(FeedbackView))({ ...entry, status: "completed" }),
        );
      }
      reads.push(path);
      const value = Schema.encodeSync(Schema.toCodecJson(FeedbackView))({
        ...entry,
        status: completed ? "completed" : "new",
      });
      if (path === "/internal/feedback" && init?.method === "GET")
        return json({ entries: [value], nextCursor: null });
      if (path === `/internal/feedback/${id}` && init?.method === "GET") return json(value);
      unexpectedRequests.push(`${init?.method} ${path}`);
      throw new Error(`Unexpected request ${path}`);
    }),
  );
  const registry = AtomRegistry.make();
  const router = createRouter({
    routeTree: createRootRoute({ component: FeedbackScreen }),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
  const screen = await render(
    <RegistryContext.Provider value={registry}>
      <RouterProvider router={router} />
    </RegistryContext.Provider>,
  );
  try {
    await expect.element(page.getByLabelText("List status")).toHaveTextContent("new");
    await expect.element(page.getByLabelText("Detail status")).toHaveTextContent("new");
    await page.getByRole("button", { name: "Change feedback status for Reporter" }).click();
    await page.getByRole("menuitem", { name: "Mark as completed" }).click();
    await expect.poll(() => writes).toEqual([{ status: "completed" }]);
    expect(writePaths).toEqual([`/internal/feedback/${id}/status`]);
    await expect
      .element(page.getByRole("button", { name: "Change feedback status for Reporter" }))
      .toBeDisabled();
    await expect.element(page.getByLabelText("Detail status")).toHaveTextContent("new");
    finish();
    await expect.element(page.getByLabelText("List status")).toHaveTextContent("completed");
    await expect.element(page.getByLabelText("Detail status")).toHaveTextContent("completed");
    expect(reads.filter((path) => path === "/internal/feedback")).toHaveLength(2);
    expect(reads.filter((path) => path === `/internal/feedback/${id}`)).toHaveLength(2);
  } finally {
    finish();
    await screen.unmount();
    registry.dispose();
  }
});
