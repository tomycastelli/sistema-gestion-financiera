import Link from "next/link"
import { Icons } from "./ui/Icons"
import { api } from "~/trpc/server"
import { Button } from "./ui/button"

const ChatsNav = async () => {
  const userChats = await api.messages.getUserChats.query(undefined)
  const totalUnseen = userChats.reduce((acc, current) => acc + current.unseenMessages, 0)

  return (
    <Button variant="outline" className="p-2">
      <Link href={"/chat"} className="flex flex-row justify-center items-center">
        <Icons.chatIcon className="mr-1 w-6 h-6 text-black hover:text-white dark:text-white" />
        {totalUnseen}
      </Link>
    </Button>
  )
}

export default ChatsNav
