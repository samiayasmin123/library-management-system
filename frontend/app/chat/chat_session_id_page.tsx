import ChatPage from "../../chatui";

export default function Page({ params }: { params: { sessionId: string } }) {
  const sessionId = Number(params.sessionId);
  return <ChatPage initialSessionId={Number.isNaN(sessionId) ? null : sessionId} />;
}
