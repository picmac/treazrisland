import { CollectionDetailPage } from "@/src/library/collection-detail-page";

type CollectionDetailRouteProps = {
  params: { slug: string };
};

export default function CollectionDetailRoute({ params }: CollectionDetailRouteProps) {
  return <CollectionDetailPage slug={params.slug} />;
}
