"use client"

import { type RouterOutputs } from "~/trpc/shared"
import ChatPreview from "./ChatPreview"
import { Separator } from "../components/ui/separator"
import { type FC } from "react"
import { api } from "~/trpc/react"
import LoadingAnimation from "../components/LoadingAnimation"

interface ChatListProps {
  initialUserChats: RouterOutputs["messages"]["getUserChats"]
}

const ChatList: FC<ChatListProps> = ({ initialUserChats }) => {
  const { data: userChats, isSuccess, isLoading } = api.messages.getUserChats.useQuery(undefined, {
    initialData: initialUserChats,
    refetchOnWindowFocus: false
  })

  return (
    !isLoading ? (
      <div className='grid grid-cols-1 gap-y-1'>
        {isSuccess && userChats.length > 0 ? (
          userChats.map(chat => (
            <div key={chat.id}>
              <Separator className="my-1" />
              <ChatPreview chat={chat} />
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center">
            <h2 className="text-lg font-semibold">No hay chats creados</h2>
          </div>
        )}
      </div>
    ) : (
      <LoadingAnimation text="Cargando chats" />
    )
  )
}

export default ChatList
