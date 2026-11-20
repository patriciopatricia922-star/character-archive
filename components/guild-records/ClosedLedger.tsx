import Link from "next/link";
import { guildRecords } from "../../data/guildRecords";
import GuildRecordsBook from "./GuildRecordsBook";
import "./ClosedLedger.css";

export default function ClosedLedger({
  entryToken,
}: {
  entryToken?: string;
}) {
  return (
    <main className="guildRecordsPage">
      <div className="guildRecordsAtmosphere" aria-hidden="true">
        <div className="guildRecordsDesk" />
      </div>

      <Link className="guildRecordsReturnLink" href="/">
        Return to archive
      </Link>

      <div className="guildRecordsExperience">
        <div className="guildRecordsBookStage">
          <GuildRecordsBook guilds={guildRecords} entryToken={entryToken} />
        </div>
      </div>
    </main>
  );
}
