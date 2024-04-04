import { type ReactNode } from "react";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import Sidebar from "./Sidebar";

const ChatLayout = async ({ children }: { children: ReactNode }) => {
  const user = await getUser()
  const userChats = await api.messages.getUserChats.query()

  if (!user) {
    return (<h1 className="text-2xl font-semibold">El usuario no está autentificado</h1>)
  }

  return (
    <div className="grid grid-cols-5">
      <div className="col-span-1 border-r-slate-900">
        <Sidebar user={user} userChats={userChats} />
      </div>
      <div className="col-span-4">{children}</div>
    </div>
  )
}

export default ChatLayout
