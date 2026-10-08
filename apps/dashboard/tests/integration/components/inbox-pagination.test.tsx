import { renderToStaticMarkup } from "react-dom/server";

import { describe, expect, it } from "vitest";

import { NotificationList } from "../../../src/routes/_authenticated/-components/inbox/notification-list";

const emptyNotifications = [] as const;
const noop = () => {};

describe("filtered inbox pagination", () => {
  it("keeps later pages reachable when the loaded page has no matching notifications", () => {
    const markup = renderToStaticMarkup(
      <NotificationList
        items={emptyNotifications}
        selectedId={null}
        canLoadMore
        isLoadingMore={false}
        onLoadMore={noop}
        onSelect={noop}
      />,
    );
    expect(markup).toContain("No notifications");
    expect(markup).toContain("Load more");
    expect(markup).not.toContain("disabled");
  });
});
