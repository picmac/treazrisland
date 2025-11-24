import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminRomUploadPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const adminMocks = vi.hoisted(() => ({
  requestRomUploadGrant: vi.fn(),
  verifyRomUpload: vi.fn(),
  registerAdminRom: vi.fn(),
  reportRomUploadFailure: vi.fn(),
  directRomUpload: vi.fn(),
}));

vi.stubGlobal('crypto', {
  subtle: {
    digest: vi.fn(async () => new Uint8Array([0, 1, 2]).buffer),
  },
  getRandomValues: () => new Uint8Array([1, 2, 3]),
} as unknown as Crypto);

class FakeFileReader {
  public result: ArrayBuffer | null = null;
  public onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;
  public onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => unknown) | null = null;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  readAsArrayBuffer(_file: Blob): void {
    this.result = new ArrayBuffer(4);
    this.onprogress?.({ lengthComputable: true, loaded: 4, total: 4 } as ProgressEvent<FileReader>);
    this.onload?.({} as ProgressEvent<FileReader>);
  }
}

vi.stubGlobal('FileReader', FakeFileReader);

vi.mock('@/lib/admin', () => adminMocks);

global.fetch = vi.fn(() => Promise.resolve({ ok: true })) as unknown as typeof fetch;

describe('Admin ROM upload page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adminMocks.requestRomUploadGrant.mockResolvedValue({
      uploadUrl: 'https://upload',
      objectKey: 'roms/123',
    });
    adminMocks.verifyRomUpload.mockResolvedValue({ valid: true });
    adminMocks.registerAdminRom.mockResolvedValue({ rom: { id: 'rom-abc' } });
    adminMocks.directRomUpload.mockResolvedValue({ objectKey: 'roms/123' });
  });

  it('runs the happy path upload flow', async () => {
    render(<AdminRomUploadPage />);

    const fileInput = screen.getByLabelText(/rom file/i, { selector: 'input' });
    const romFile = new File(['payload'], 'demo.smc', { type: 'application/octet-stream' });

    fireEvent.change(fileInput, { target: { files: [romFile] } });

    await waitFor(() =>
      expect(screen.getByTestId('rom-upload-status')).toHaveTextContent(/checksum locked/i),
    );

    fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Demo Quest' } });
    fireEvent.change(screen.getByLabelText(/platform/i), { target: { value: 'snes' } });

    fireEvent.submit(screen.getByRole('button', { name: /create rom/i }).closest('form')!);

    await waitFor(() => expect(adminMocks.registerAdminRom).toHaveBeenCalled());

    expect(adminMocks.requestRomUploadGrant).toHaveBeenCalledWith({
      filename: 'demo.smc',
      contentType: 'application/octet-stream',
      size: romFile.size,
      checksum: expect.any(String),
    });
    expect(adminMocks.verifyRomUpload).toHaveBeenCalledWith({
      objectKey: 'roms/123',
      checksum: expect.any(String),
    });
    expect(adminMocks.registerAdminRom.mock.calls[0][0].asset.objectKey).toBe('roms/123');
  });

  it('shows a validation message when checksum is missing', async () => {
    render(<AdminRomUploadPage />);

    fireEvent.submit(screen.getByRole('button', { name: /create rom/i }).closest('form')!);

    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/select a rom file/i));
    expect(adminMocks.registerAdminRom).not.toHaveBeenCalled();
  });
});
