import LibraryExplorerPage from "@/src/library/library-explorer-page";

type PageProps = {
  params: { platformSlug: string };
};

export default function PlatformLibraryRoute({ params }: PageProps) {
  return <LibraryExplorerPage initialPlatformSlug={params.platformSlug} />;
}
