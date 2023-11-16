import { getServerAuthSession } from "~/server/auth";
import { api } from "~/trpc/server";
import { type RouterOutputs } from "~/trpc/shared";
import Balances from "./Balances";
import MovementsTable from "./MovementsTable";

const AccountsTable = async ({
  searchParams,
  initialBalances,
  accountType,
}: {
  searchParams: Record<string, string | string[] | undefined>;
  initialBalances: RouterOutputs["movements"]["getBalancesByEntities"];
  accountType: boolean;
}) => {
  const session = await getServerAuthSession();
  console.log(session);

  const selectedEntityString = searchParams.entidad as string;
  const selectedEntity = selectedEntityString
    ? parseInt(selectedEntityString)
    : undefined;
  const selectedTag = searchParams.tag as string;
  const selectedPageNumber = parseInt(searchParams.pagina as string) || 1;

  const linkId = parseInt(searchParams.id as string) || null;
  const linkToken = (searchParams.token as string) || null;

  const isPerspectiveSelected =
    selectedEntity !== undefined || selectedTag !== undefined;

  const pageSize = 15;

  const initialMovements = await api.movements.getCurrentAccounts.query({
    linkId: linkId,
    linkToken: linkToken,
    sharedEntityId: selectedEntity,
    pageSize: pageSize,
    pageNumber: selectedPageNumber,
    entityId: selectedEntity,
    entityTag: selectedTag,
    account: accountType ? "caja" : "cuenta_corriente",
  });

  return (
    <div className="flex flex-grow flex-col space-y-8">
      <Balances accountType={accountType} initialBalances={initialBalances} />
      {isPerspectiveSelected && (
        <MovementsTable
          accountType={accountType}
          session={session}
          pageSize={pageSize}
          pageNumber={selectedPageNumber}
          initialMovements={initialMovements}
          entityTag={selectedTag}
          entityId={selectedEntity}
          account={accountType ? "caja" : "cuenta_corriente"}
        />
      )}
    </div>
  );
};

export default AccountsTable;
