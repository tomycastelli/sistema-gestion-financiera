import { redirect } from "next/navigation";
import { getUser } from "~/server/auth";
import { api } from "~/trpc/server";
import PendingTransactions from "./PendingTransactions";
import { getAllChildrenTags } from "~/lib/functions";

const Page = async () => {
  const user = await getUser();
  if (!user) {
    redirect("/");
  }

  const { data: mainTagData } = await api.globalSettings.get.query({
    name: "mainTag",
  });

  const filteredTags = await api.tags.getFiltered.query();

  const mainTag = mainTagData as { tag: string };

  const mainTags = getAllChildrenTags(mainTag.tag, filteredTags);

  const initialPendingTransactions =
    await api.operations.getPendingTransactions.query();

  return initialPendingTransactions.length > 0 ? (
    <div className="mt-6 flex flex-col gap-y-8">
      <h1 className="text-3xl font-semibold">
        Transacciones pendientes de aprobación
      </h1>
      <PendingTransactions
        user={user}
        initialPendingTransactions={initialPendingTransactions}
        mainTags={mainTags}
      />
    </div>
  ) : (
    <div className="mt-6 flex w-full items-center justify-center">
      <h1 className="text-3xl font-semibold">
        No hay transacciones pendientes para aprobar
      </h1>
    </div>
  );
};

export default Page;
