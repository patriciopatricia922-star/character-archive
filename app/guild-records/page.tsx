import type { Metadata } from "next";
import { Suspense } from "react";
import ClosedLedger from "../../components/guild-records/ClosedLedger";

export const metadata: Metadata = {
  title: "Guild Records | Character Archive",
  description: "Guild Records registry ledger.",
};

async function GuildRecordsContent({
  searchParams,
}: Pick<PageProps<"/guild-records">, "searchParams">) {
  const { entry } = await searchParams;
  return <ClosedLedger entryToken={typeof entry === "string" ? entry : undefined} />;
}

export default function GuildRecordsPage(
  props: PageProps<"/guild-records">,
) {
  return (
    <Suspense fallback={<ClosedLedger />}>
      <GuildRecordsContent searchParams={props.searchParams} />
    </Suspense>
  );
}
