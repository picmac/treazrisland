import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/onboarding/sections/first-admin-form", () => ({
  FirstAdminForm: () => <div data-testid="first-admin-form">first-admin-form</div>
}));

vi.mock("@/src/onboarding/setup-wizard", () => ({
  SetupWizard: ({ initialStatus }: { initialStatus: unknown }) => (
    <div data-testid="setup-wizard">{JSON.stringify(initialStatus)}</div>
  )
}));

vi.mock("next/headers", () => ({
  headers: () => new Headers()
}));

vi.mock("@lib/api/onboarding", async () => {
  const actual = await vi.importActual<typeof import("@lib/api/onboarding")>("@lib/api/onboarding");
  return {
    ...actual,
    fetchOnboardingStatus: vi.fn()
  };
});

const { fetchOnboardingStatus } = await import("@lib/api/onboarding");
const OnboardingEntry = (await import("./onboarding-entry")).default;
const { ApiError } = await import("@/src/lib/api/client");

describe("OnboardingEntry", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders the first admin form when the backend indicates setup is required", async () => {
    const now = new Date().toISOString();
    vi.mocked(fetchOnboardingStatus).mockResolvedValueOnce({
      needsSetup: true,
      setupComplete: false,
      steps: {
        "first-admin": { status: "PENDING", updatedAt: now },
        "system-profile": { status: "PENDING", updatedAt: now },
        integrations: { status: "PENDING", updatedAt: now },
        personalization: { status: "PENDING", updatedAt: now }
      },
      pendingSteps: ["first-admin", "system-profile"]
    });

    const ui = await OnboardingEntry();
    render(ui);

    expect(fetchOnboardingStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Welcome, Keeper of the Vault/i)).toBeInTheDocument();
    expect(screen.getByTestId("first-admin-form")).toBeInTheDocument();
    expect(screen.queryByTestId("setup-wizard")).not.toBeInTheDocument();
  });

  it("synthesizes a fallback status when onboarding status requests are unauthorized", async () => {
    vi.mocked(fetchOnboardingStatus).mockRejectedValueOnce(new ApiError("Auth required", 401));

    const ui = await OnboardingEntry();
    render(ui);

    expect(fetchOnboardingStatus).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("first-admin-form")).toBeInTheDocument();
    expect(
      screen.getByText(
        /We couldn't confirm the onboarding status \(401\). API response: Auth required\. You can still forge the inaugural admin, but double-check your backend auth chart\./i
      )
    ).toBeInTheDocument();
    expect(screen.queryByTestId("setup-wizard")).not.toBeInTheDocument();
  });
});
