import { PlatformDetailPage } from "@/src/library/platform-detail-page";

type PageProps = {
  params: { slug: string };
};

export default function PlatformSlugPage({ params }: PageProps) {
  return <PlatformDetailPage slug={params.slug} />;
}
