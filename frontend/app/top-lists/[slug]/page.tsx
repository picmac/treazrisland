import { TopListDetailPage } from "@/src/library/top-list-detail-page";

type TopListDetailRouteProps = {
  params: { slug: string };
};

export default function TopListDetailRoute({ params }: TopListDetailRouteProps) {
  return <TopListDetailPage slug={params.slug} />;
}
