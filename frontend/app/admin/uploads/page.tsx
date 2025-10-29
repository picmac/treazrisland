import { PixelFrame } from "@/src/components/pixel-frame";
import { RomUploadManager } from "@/src/admin/uploads/RomUploadManager";

export default function AdminUploadsPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 p-6 text-white">
      <PixelFrame className="space-y-4 p-6">
        <header className="space-y-2 text-center">
          <h1 className="text-xl uppercase tracking-widest text-primary">ROM & BIOS Dropzone</h1>
          <p className="text-sm text-slate-200">
            Queue cartridge and BIOS archives for the library. Files are streamed directly to storage
            using ES-DE folder conventions, preserving original archive names wherever possible.
          </p>
        </header>
        <RomUploadManager />
      </PixelFrame>
    </main>
  );
}
