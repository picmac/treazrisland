import { PixelFrame } from "@/src/components/pixel-frame";
import { CreativeAssetManager } from "@/src/admin/creative-assets/CreativeAssetManager";

export default function AdminCreativeAssetsPage() {
  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-6 p-6 text-white">
      <PixelFrame className="space-y-3 bg-night/80 p-6">
        <header className="space-y-2 text-center">
          <h1 className="text-xl uppercase tracking-[0.4em] text-primary">Curated Artwork Vault</h1>
          <p className="text-sm text-slate-200">
            Upload, assign, and rotate bespoke hero art across the TREAZRISLAND library. Assets published here override
            automated metadata art so the island always reflects the crew’s current mood.
          </p>
        </header>
      </PixelFrame>

      <CreativeAssetManager />
    </main>
  );
}
