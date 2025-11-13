export interface SaveState {
  id: string;
  romId: string;
  slot: number;
  label?: string | null;
  size: number;
  contentType: string;
  checksum: string;
  createdAt: string;
  updatedAt: string;
}
