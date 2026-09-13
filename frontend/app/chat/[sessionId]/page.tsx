import ChatPage from "../chatui";

export default async function Page({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  return <ChatPage initialSessionId={sessionId} />;
}
