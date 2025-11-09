import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { LoginForm } from "@/src/auth/login-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn()
  })
}));

vi.mock("@/src/auth/session-provider", () => ({
  useSession: () => ({
    setSession: vi.fn()
  })
}));

async function expectAccessible(container: HTMLElement) {
  const results = await axe.run(container);
  expect(results.violations).toHaveLength(0);
}

describe("LoginForm accessibility", () => {
  afterEach(() => {
    cleanup();
  });

  it("passes axe checks", async () => {
    const { container } = render(<LoginForm />);
    await expectAccessible(container);
  });

  it("supports keyboard navigation order", async () => {
    const user = userEvent.setup();
    const { getByLabelText, getByRole } = render(<LoginForm />);

    await user.tab();
    expect(getByLabelText(/email or nickname/i)).toHaveFocus();

    await user.tab();
    expect(getByLabelText(/password/i)).toHaveFocus();

    await user.tab();
    expect(getByRole("button", { name: /log in/i })).toHaveFocus();
  });
});
