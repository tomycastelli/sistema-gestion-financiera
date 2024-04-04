import Link from "next/link"
import { type RouterOutputs } from "~/trpc/shared"

interface ChatPreviewProps {
  chat: RouterOutputs["messages"]["getUserChats"][number]
}

const ChatPreview = ({ chat }: ChatPreviewProps) => {
  return (
    <Link key={chat.id} className="flex flex-row items-center justify-between gap-2 my-2 hover:border-l-8 hover:border-primary hover:transition-all" href={`/chat/${chat.id}`}>
      <h2 className="text-lg">
        {chat.name ? chat.name : chat.users.length < 4 ? chat.users.map(obj => obj.name).join(", ") : chat.id.toString()}
      </h2>
      {chat.unseenMessages > 0 && (
        <span className="h-6 w-6 bg-primary rounded-full flex justify-center items-center text-white">{chat.unseenMessages}</span>
      )}
    </Link>
  )
}

export default ChatPreview
