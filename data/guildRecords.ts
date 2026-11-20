import guild1Emblem from "../assets/guild-1.png";
import guild2Emblem from "../assets/guild-2.png";
import guild3Emblem from "../assets/guild-3.png";

export type ArchiveImage = {
  src: string;
  alt?: string;
};

export type MemberPortrait = ArchiveImage & {
  fit?: "contain" | "cover";
};

export type GuildAmendment = {
  id: string;
  date?: string;
  correction: string;
  initials?: string;
};

export type GuildAttachment = {
  id: string;
  title: string;
  description?: string;
  href?: string;
};

export type GuildMemberRecord = {
  id: string;
  fullName: string;
  portrait?: MemberPortrait;
  registeredTitle?: string;
  rank?: string;
  registrationDate?: string;
  referenceId?: string;
  status?: string;
  description?: string;
  remarks?: string;
  annotations?: readonly string[];
  amendments?: readonly GuildAmendment[];
  attachments?: readonly GuildAttachment[];
};

export type GuildRecord = {
  id: string;
  name: string;
  emblem?: ArchiveImage;
  emblemScale?: number;
  description?: string;
  members: readonly GuildMemberRecord[];
};

export type GuildLedgerSpread =
  | {
      id: "index";
      kind: "index";
      guilds: readonly GuildRecord[];
    }
  | {
      id: string;
      kind: "guild";
      guild: GuildRecord;
    }
  | {
      id: string;
      kind: "member";
      guild: GuildRecord;
      member: GuildMemberRecord;
    }
  | {
      id: string;
      kind: "supplement";
      guild: GuildRecord;
      member: GuildMemberRecord;
      part: number;
      parts: number;
      amendments: readonly GuildAmendment[];
      annotations: readonly string[];
      attachments: readonly GuildAttachment[];
    };

function splitIntoPages<T>(items: readonly T[], pageSize: number): T[][] {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }
  return pages;
}

export function getGuildSpreadId(guildId: string): string {
  return `guild:${encodeURIComponent(guildId)}`;
}

export function getMemberSpreadId(
  guildId: string,
  memberId: string,
): string {
  return `member:${encodeURIComponent(guildId)}:${encodeURIComponent(memberId)}`;
}

export function buildGuildLedgerSpreads(
  guilds: readonly GuildRecord[],
): GuildLedgerSpread[] {
  const spreads: GuildLedgerSpread[] = [
    { id: "index", kind: "index", guilds },
  ];

  for (const guild of guilds) {
    spreads.push({
      id: getGuildSpreadId(guild.id),
      kind: "guild",
      guild,
    });

    for (const member of guild.members) {
      spreads.push({
        id: getMemberSpreadId(guild.id, member.id),
        kind: "member",
        guild,
        member,
      });

      const amendmentPages = splitIntoPages(member.amendments ?? [], 3);
      const annotationPages = splitIntoPages(member.annotations ?? [], 4);
      const attachmentPages = splitIntoPages(member.attachments ?? [], 3);
      const supplementCount = Math.max(
        amendmentPages.length,
        annotationPages.length,
        attachmentPages.length,
      );

      for (let pageIndex = 0; pageIndex < supplementCount; pageIndex += 1) {
        spreads.push({
          id: `supplement:${encodeURIComponent(guild.id)}:${encodeURIComponent(
            member.id,
          )}:${pageIndex + 1}`,
          kind: "supplement",
          guild,
          member,
          part: pageIndex + 1,
          parts: supplementCount,
          amendments: amendmentPages[pageIndex] ?? [],
          annotations: annotationPages[pageIndex] ?? [],
          attachments: attachmentPages[pageIndex] ?? [],
        });
      }
    }
  }

  return spreads;
}

export const guildRecords: readonly GuildRecord[] = [
  {
    id: "guild-1",
    name: "Windborne Vesperwind",
    emblem: {
      src: guild1Emblem.src,
      alt: "Windborne Vesperwind guild emblem",
    },
    members: [],
  },
  {
    id: "guild-2",
    name: "Encore Masquerade",
    emblem: {
      src: guild2Emblem.src,
      alt: "Encore Masquerade guild emblem",
    },
    emblemScale: 1.35,
    members: [],
  },
  {
    id: "guild-3",
    name: "Celestial HeartBound",
    emblem: {
      src: guild3Emblem.src,
      alt: "Celestial HeartBound guild emblem",
    },
    emblemScale: 1.35,
    members: [],
  },
];
