import { render, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { VirtualizedGrid } from "@/src/components/virtualized-grid";

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: 200
  });
});

describe("VirtualizedGrid", () => {
  it("renders only a subset of items and updates on scroll", async () => {
    const items = Array.from({ length: 100 }, (_, index) => `Item ${index}`);
    const { getByText, queryByText, container } = render(
      <div style={{ height: 200 }}>
        <VirtualizedGrid
          items={items}
          columns={1}
          rowHeight={50}
          renderItem={(item) => <div>{item}</div>}
        />
      </div>
    );

    expect(getByText("Item 0")).toBeInTheDocument();
    expect(queryByText("Item 99")).toBeNull();

    const scrollContainer = container.querySelector("div.h-full") as HTMLElement;
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 4000 } });

    expect(queryByText("Item 0")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(getByText("Item 80")).toBeInTheDocument();
    });
  });
});
