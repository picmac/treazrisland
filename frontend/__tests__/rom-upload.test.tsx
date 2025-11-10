import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { UserRomUploadManager } from "@/src/roms/uploads/UserRomUploadManager";
import { MAX_UPLOAD_SIZE_BYTES } from "@/src/uploads/constants";
import { listPlatforms } from "@lib/api/library";
import { uploadRomArchive } from "@lib/api/uploads";

vi.mock("@lib/api/library", () => ({
  listPlatforms: vi.fn()
}));

vi.mock("@lib/api/uploads", () => ({
  uploadRomArchive: vi.fn()
}));

const randomUUID = vi.fn(() => "upload-1");

beforeAll(() => {
  vi.stubGlobal("crypto", {
    randomUUID
  });
});

afterAll(() => {
  vi.unstubAllGlobals();
});

beforeEach(() => {
  randomUUID.mockClear();
  randomUUID.mockReturnValue("upload-1");
  vi.mocked(uploadRomArchive).mockReset();
  vi.mocked(listPlatforms).mockResolvedValue({
    platforms: [
      {
        id: "platform-1",
        name: "Super Nintendo",
        slug: "snes",
        shortName: "SNES",
        screenscraperId: 3,
        romCount: 0,
        heroArt: null,
        featuredRom: null
      }
    ]
  });
});

describe("UserRomUploadManager", () => {
  it("uploads ROMs successfully", async () => {
    vi.mocked(uploadRomArchive).mockResolvedValue({
      result: {
        status: "success",
        metadata: {
          clientId: "upload-1",
          type: "rom",
          originalFilename: "chrono.zip",
          platformSlug: "snes",
          romTitle: "Chrono"
        },
        storageKey: "roms/snes/chrono.zip",
        archiveSize: 123,
        checksumSha256: "abc",
        uploadAuditId: "audit-1"
      }
    });

    const { container } = render(<UserRomUploadManager />);

    await waitFor(() => expect(listPlatforms).toHaveBeenCalled());

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["content"], "chrono.zip", { type: "application/zip" });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await screen.findByText("chrono.zip");

    fireEvent.click(screen.getByRole("button", { name: /Start Upload/i }));

    await waitFor(() => expect(uploadRomArchive).toHaveBeenCalled());

    expect(uploadRomArchive).toHaveBeenCalledWith(
      expect.objectContaining({
        platformSlug: "snes",
        originalFilename: "chrono.zip"
      }),
      file
    );

    await screen.findByText(/Upload completed/i);
    expect(screen.getByText(/Uploaded/)).toBeInTheDocument();
  });

  it("shows duplicate messaging when conflicts occur", async () => {
    vi.mocked(uploadRomArchive).mockResolvedValue({
      result: {
        status: "duplicate",
        metadata: {
          clientId: "upload-1",
          type: "rom",
          originalFilename: "duplicate.zip",
          platformSlug: "snes"
        },
        reason: "Already exists",
        uploadAuditId: "audit-dup"
      }
    });

    const { container } = render(<UserRomUploadManager />);

    await waitFor(() => expect(listPlatforms).toHaveBeenCalled());

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["rom"], "duplicate.zip", { type: "application/zip" });

    fireEvent.change(fileInput, { target: { files: [file] } });
    await screen.findByText("duplicate.zip");

    fireEvent.click(screen.getByRole("button", { name: /Start Upload/i }));

    await screen.findByText(/Already exists/i);
    expect(screen.getByText(/Duplicate/)).toBeInTheDocument();
  });

  it("prevents oversize files from being queued", async () => {
    const { container } = render(<UserRomUploadManager />);

    await waitFor(() => expect(listPlatforms).toHaveBeenCalled());

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const oversize = new File(["big"], "huge.zip", { type: "application/zip" });
    Object.defineProperty(oversize, "size", {
      value: MAX_UPLOAD_SIZE_BYTES + 1
    });

    fireEvent.change(fileInput, { target: { files: [oversize] } });

    await screen.findByText(/exceeds the 1 GiB limit/i);
    expect(screen.queryByText("huge.zip")).not.toBeInTheDocument();
    expect(uploadRomArchive).not.toHaveBeenCalled();
  });
});
