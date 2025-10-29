import { cookies } from "next/headers";
import { PixelFrame } from "@/src/components/pixel-frame";
import { listNetplaySessions } from "@lib/api/netplay";
import { HostForm } from "@/src/netplay/HostForm";
import { JoinForm } from "@/src/netplay/JoinForm";
import { SessionList } from "@/src/netplay/SessionList";

export const dynamic = "force-dynamic";

export default async function NetplayPage() {
  const cookieHeader = cookies().toString();
  const { sessions } = await listNetplaySessions({
    headers: cookieHeader ? { Cookie: cookieHeader } : undefined
  });

  return (
    <main className="flex flex-1 flex-col gap-6">
      <PixelFrame className="space-y-3 bg-night/80 p-6 text-parchment">
        <h1 className="text-3xl font-bold text-lagoon">Netplay docks</h1>
        <p className="max-w-2xl text-sm text-parchment/80">
          Coordinate cooperative voyages, share join codes, and monitor your active crews from a single SNES-inspired command
          deck.
        </p>
      </PixelFrame>

      <div className="grid gap-6 md:grid-cols-2">
        <PixelFrame className="bg-night/80 p-6">
          <HostForm />
        </PixelFrame>
        <PixelFrame className="bg-night/80 p-6">
          <JoinForm />
        </PixelFrame>
      </div>

      <PixelFrame className="bg-night/80 p-6 text-parchment">
        <h2 className="text-2xl font-semibold text-lagoon">Your sessions</h2>
        <div className="mt-4">
          <SessionList sessions={sessions} />
        </div>
      </PixelFrame>
    </main>
  );
}
