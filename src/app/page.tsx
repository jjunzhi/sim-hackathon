import { Landing } from "@/components/landing";

export default async function Home({ searchParams }: { searchParams: Promise<{ accountDeleted?: string }> }) {
  const { accountDeleted } = await searchParams;
  return <Landing accountDeleted={accountDeleted === "1"} />;
}
