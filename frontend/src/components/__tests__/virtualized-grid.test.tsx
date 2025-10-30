import { render, fireEvent, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("preserves scroll position when appending items with a stable reset key", async () => {
    const items = Array.from({ length: 40 }, (_, index) => `Item ${index}`);
    const { container, rerender } = render(
      <div style={{ height: 200 }}>
        <VirtualizedGrid
          items={items.slice(0, 20)}
          columns={1}
          rowHeight={50}
          renderItem={(item) => <div>{item}</div>}
          resetKey="stable"
        />
      </div>
    );

    const scrollContainer = container.querySelector("div.h-full") as HTMLElement;
    Object.defineProperty(scrollContainer, "scrollTop", { configurable: true, value: 150, writable: true });
    scrollContainer.scrollTo = vi.fn(({ top }: { top: number }) => {
      Object.defineProperty(scrollContainer, "scrollTop", { configurable: true, value: top, writable: true });
    });

    fireEvent.scroll(scrollContainer, { target: { scrollTop: 150 } });

    rerender(
      <div style={{ height: 200 }}>
        <VirtualizedGrid
          items={items}
          columns={1}
          rowHeight={50}
          renderItem={(item) => <div>{item}</div>}
          resetKey="stable"
        />
      </div>
    );

    await waitFor(() => {
      expect(scrollContainer.scrollTo).not.toHaveBeenCalled();
    });
  });

  it("resets scroll when the reset key changes", async () => {
    const items = Array.from({ length: 20 }, (_, index) => `Item ${index}`);
    const { container, rerender } = render(
      <div style={{ height: 200 }}>
        <VirtualizedGrid
          items={items}
          columns={1}
          rowHeight={50}
          renderItem={(item) => <div>{item}</div>}
          resetKey="alpha"
        />
      </div>
    );

    const scrollContainer = container.querySelector("div.h-full") as HTMLElement;
    Object.defineProperty(scrollContainer, "scrollTop", { configurable: true, value: 200, writable: true });
    scrollContainer.scrollTo = vi.fn(({ top }: { top: number }) => {
      Object.defineProperty(scrollContainer, "scrollTop", { configurable: true, value: top, writable: true });
    });

    fireEvent.scroll(scrollContainer, { target: { scrollTop: 200 } });

    rerender(
      <div style={{ height: 200 }}>
        <VirtualizedGrid
          items={items}
          columns={1}
          rowHeight={50}
          renderItem={(item) => <div>{item}</div>}
          resetKey="beta"
        />
      </div>
    );

    await waitFor(() => {
      expect(scrollContainer.scrollTo).toHaveBeenCalledWith({ top: 0 });
    });
  });
});
