import Link from "next/link"
import { Icons } from "./ui/Icons"
import { api } from "~/trpc/server"

const ChatsNav = async () => {
  const userChats = await api.messages.getUserChats.query(undefined)
  const totalUnseen = userChats.reduce((acc, current) => acc + current.unseenMessages, 0)

  return (
    <Link href={"/chat"} className="p-2 text-primary hover:text-white bg-primary-foreground flex justify-center items-center rounded-full hover:bg-primary transition-all">
      <Icons.chatIcon className="mr-1 w-6 h-6 text-black hover:text-white dark:text-white" />
      {totalUnseen}
    </Link>
  )
}

export default ChatsNav
