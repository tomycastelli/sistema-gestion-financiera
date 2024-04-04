import { ScrollArea } from "../components/ui/scroll-area"
import AddChat from "./AddChat"
import { type User } from "lucia"
import { type RouterOutputs } from "~/trpc/shared"
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card"
import ChatList from "./ChatList"

interface SidebarProps {
  user: User
  userChats: RouterOutputs["messages"]["getUserChats"]
}

const Sidebar = ({ user, userChats }: SidebarProps) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Chats</CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="flex w-full h-full">
          <nav className="grid grid-cols-1 gap-y-2">
            <AddChat user={user} />
            <ChatList initialUserChats={userChats} />
          </nav>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export default Sidebar
