import type { Metadata } from "next";
import ClosedLedger from "../../components/guild-records/ClosedLedger";

export const metadata: Metadata = {
  title: "Guild Records | Character Archive",
  description: "Guild Records registry ledger.",
};

export default function GuildRecordsPage() {
  return <ClosedLedger />;
}
