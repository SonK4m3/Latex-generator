import { redirect } from "next/navigation";
import HomeClient from "@/components/HomeClient";
import { listDocuments } from "@/lib/store/documentStore";
import { getCurrentUserId } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const userId = await getCurrentUserId();
  if (!userId) {
    redirect("/login?redirectTo=/app");
  }
  const documents = await listDocuments(userId);
  return <HomeClient initialDocuments={documents} />;
}
