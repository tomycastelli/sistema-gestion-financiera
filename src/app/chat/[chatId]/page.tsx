import { isNumeric } from "~/lib/functions";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import Chat from "./Chat";
import { env } from "~/env.mjs";

type Params = Promise<{ chatId: string }>;

const Page = async (props: { params: Params }) => {
  const params = await props.params;
  const user = await getUser();
  if (!user) {
    return <h1>El usuario no está autentificado</h1>;
  }
  if (!isNumeric(params.chatId)) {
    return (
      <h1 className="text-2xl font-semibold">El ID del chat no es válido</h1>
    );
  }
  const messagesHistory = await api.messages.getChatHistory.query({
    chatId: parseInt(params.chatId),
    limit: 15,
    page: 1,
  });
  const users = await api.users.getAll.query();

  return (
    <Chat
      chatUrl={env.CHAT_URL}
      initialMessagesHistory={messagesHistory}
      users={users}
      currentUser={user}
      chatId={parseInt(params.chatId)}
    />
  );
};

export default Page;
