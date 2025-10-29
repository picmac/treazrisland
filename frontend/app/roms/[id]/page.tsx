import { RomDetailSheet } from "@/src/library/rom-detail-sheet";

type PageProps = {
  params: { id: string };
};

export default function RomDetailPage({ params }: PageProps) {
  return <RomDetailSheet id={params.id} />;
}
