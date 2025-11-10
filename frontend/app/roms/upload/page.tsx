import { PixelFrame } from "@/src/components/pixel-frame";
import { UserRomUploadManager } from "@/src/roms/uploads/UserRomUploadManager";

export default function UserRomUploadPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 p-6 text-white">
      <PixelFrame className="space-y-4 p-6">
        <header className="space-y-2 text-center">
          <h1 className="text-xl uppercase tracking-widest text-primary">Upload Your ROMs</h1>
          <p className="text-sm text-slate-200">
            Stream personal ROM archives directly to your collection. Files are stored securely with their
            original filenames so you can jump back into action quickly.
          </p>
        </header>
        <UserRomUploadManager />
      </PixelFrame>
    </main>
  );
}
