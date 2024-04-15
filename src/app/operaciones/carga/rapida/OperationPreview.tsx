"use client"

import moment from "moment"
import Link from "next/link"
import { type FC, memo } from "react"
import { Card, CardDescription, CardHeader, CardTitle } from "~/app/components/ui/card"
import { dateFormat } from "~/lib/variables"
import { type RouterOutputs } from "~/trpc/shared"

interface OperationPreviewProps {
  op: RouterOutputs["operations"]["insertOperation"]
}

const OperationPreview: FC<OperationPreviewProps> = memo(({ op }) => {
  return (
    <Card className="flex">
      <Link href={`/operaciones/gestion/${op.operation.id}`} prefetch={false}>
        <CardHeader>
          <CardTitle>Operación {op.operation.id}</CardTitle>
          <CardTitle className="font-light text-muted-foreground">{moment(op.operation.date).format(dateFormat)}</CardTitle>
          <CardDescription><span className="text-primary">{op.transactions.length}</span> transacciones</CardDescription>
        </CardHeader>
      </Link>
    </Card>
  )
})

OperationPreview.displayName = "OperationPreview";

export default OperationPreview
