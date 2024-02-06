"use client";

import { useAutoAnimate } from "@formkit/auto-animate/react";
import moment from "moment";
import { useState, type FC } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { type RouterOutputs } from "~/trpc/shared";
import { Icons } from "../components/ui/Icons";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "../components/ui/hover-card";

interface LogProps {
  log: RouterOutputs["logs"]["getLogs"]["logs"][number];
  users: RouterOutputs["users"]["getAll"];
}

const Log: FC<LogProps> = ({ log, users }) => {
  const [parent] = useAutoAnimate();

  const [textToRender, setTextToRender] = useState<string | undefined>(
    undefined,
  );
  const time = moment(parseInt(log.sk)).format("HH:mm:ss");
  const date = moment(parseInt(log.sk)).format("DD-MM-YYYY");

  return (
    <Card ref={parent}>
      <CardHeader>
        <CardTitle>
          {time} <span className="text-muted-foreground">{date}</span>
        </CardTitle>
        <CardDescription>{log.name}</CardDescription>
      </CardHeader>
      {textToRender && (
        <CardContent>
          <h3 className="mb-2 text-lg font-semibold">
            {textToRender === JSON.stringify(log.input, null, 2)
              ? "Input"
              : "Output"}
          </h3>
          <SyntaxHighlighter
            language="json"
            style={docco}
            codeTagProps={{ style: { fontSize: 14 } }}
          >
            {textToRender}
          </SyntaxHighlighter>
        </CardContent>
      )}
      <CardFooter className="flex flex-row items-end justify-between">
        <div className="flex flex-row items-center justify-start space-x-2">
          <Icons.person className="h-5" />
          <p>{users.find((u) => u.id === log.createdBy)?.name}</p>
        </div>
        <div className="flex flex-row items-center justify-end space-x-2">
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                variant="outline"
                onClick={() => {
                  if (textToRender === JSON.stringify(log.input, null, 2)) {
                    setTextToRender(undefined);
                  } else {
                    setTextToRender(JSON.stringify(log.input, null, 2));
                  }
                }}
              >
                <Icons.documentPlus className="h-5" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-96">
              <h3 className="mb-2 text-lg font-semibold">Input</h3>
              <SyntaxHighlighter
                language="json"
                style={docco}
                codeTagProps={{ style: { fontSize: 14 } }}
              >
                {JSON.stringify(log.input, null, 2)}
              </SyntaxHighlighter>
            </HoverCardContent>
          </HoverCard>
          <HoverCard>
            <HoverCardTrigger asChild>
              <Button
                variant="outline"
                onClick={() => {
                  if (textToRender === JSON.stringify(log.output, null, 2)) {
                    setTextToRender(undefined);
                  } else {
                    setTextToRender(JSON.stringify(log.output, null, 2));
                  }
                }}
              >
                <Icons.documentMinus className="h-5" />
              </Button>
            </HoverCardTrigger>
            <HoverCardContent className="w-96">
              <h3 className="mb-2 text-lg font-semibold">Output</h3>
              <SyntaxHighlighter
                language="json"
                style={docco}
                codeTagProps={{ style: { fontSize: 14 } }}
              >
                {JSON.stringify(log.output, null, 2)}
              </SyntaxHighlighter>
            </HoverCardContent>
          </HoverCard>
        </div>
      </CardFooter>
    </Card>
  );
};

export default Log;
