import { redirect } from "next/navigation";

export default async function ProjectPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
  const { workspaceId, projectId } = await params;
  redirect(`/w/${workspaceId}/p/${projectId}/collections`);
}
