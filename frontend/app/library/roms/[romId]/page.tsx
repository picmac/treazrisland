import LibraryRomDetailShell from "@/src/library/library-rom-detail-shell";

type PageProps = {
  params: { romId: string };
};

export default function LibraryRomDetailPage({ params }: PageProps) {
  return <LibraryRomDetailShell romId={params.romId} />;
}
