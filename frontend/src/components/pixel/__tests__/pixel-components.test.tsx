import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import axe from "axe-core";
import { PixelButton, PixelFrame, PixelNotice } from "@/src/components/pixel";

async function expectAccessible(container: HTMLElement) {
  const results = await axe.run(container);
  expect(results.violations).toHaveLength(0);
}

describe("pixel components", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders button variants accessibly", async () => {
    const { asFragment, container } = render(
      <div className="flex flex-col gap-3">
        <PixelButton>Primary</PixelButton>
        <PixelButton variant="secondary">Secondary</PixelButton>
        <PixelButton variant="danger">Danger</PixelButton>
        <PixelButton variant="ghost" size="sm">
          Ghost
        </PixelButton>
        <PixelButton fullWidth size="lg">
          Full width
        </PixelButton>
      </div>
    );

    await expectAccessible(container);
    expect(asFragment()).toMatchSnapshot();
  });

  it("renders frame and notice pair accessibly", async () => {
    const { asFragment, container } = render(
      <PixelFrame className="space-y-3 p-4" tone="raised">
        <h2 className="text-lg font-semibold text-foreground">Frame headline</h2>
        <p className="text-sm text-foreground/80">
          PixelFrame uses semantic tone tokens so notices and nested buttons inherit consistent contrast.
        </p>
        <PixelNotice tone="info">Informational tone</PixelNotice>
        <PixelNotice tone="success">Success tone</PixelNotice>
        <PixelNotice tone="warning">Warning tone</PixelNotice>
        <PixelNotice tone="error">Error tone</PixelNotice>
      </PixelFrame>
    );

    await expectAccessible(container);
    expect(asFragment()).toMatchSnapshot();
  });
});
