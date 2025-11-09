import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { RomLookupForm } from "../page";

async function expectAccessible(container: HTMLElement) {
  const results = await axe.run(container);
  expect(results.violations).toHaveLength(0);
}

describe("RomLookupForm", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes axe checks", async () => {
    const { container } = render(<RomLookupForm defaultValue="rom-42" />);
    await expectAccessible(container);
  });

  it("allows submit via keyboard", async () => {
    const user = userEvent.setup();
    const { container, getByLabelText, getByRole } = render(<RomLookupForm defaultValue="rom-999" />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const handleSubmit = vi.fn((event: Event) => event.preventDefault());
    form?.addEventListener("submit", handleSubmit);

    const input = getByLabelText(/load by rom id/i);
    await user.clear(input);
    await user.type(input, "rom-123");
    await user.tab();
    const button = getByRole("button", { name: /load rom/i });
    await user.keyboard("{Enter}");

    expect(handleSubmit).toHaveBeenCalledOnce();
    expect(button).toHaveAttribute("type", "submit");
  });
});
