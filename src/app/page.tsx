import Console from "@/components/Console";
import { getConsoleBootstrap } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const bootstrap = await getConsoleBootstrap();
  return <Console bootstrap={bootstrap} />;
}
