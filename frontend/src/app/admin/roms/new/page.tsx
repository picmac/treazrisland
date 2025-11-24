import { redirect } from 'next/navigation';

export default function LegacyRomUploadRedirect() {
  redirect('/admin/roms/upload');
}
