"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type { TransitionEvent } from "react";
import { EB_Garamond } from "next/font/google";
import { useRouter } from "next/navigation";
import {
  buildGuildLedgerSpreads,
  getGuildSpreadId,
  getMemberSpreadId,
} from "../../data/guildRecords";
import type {
  GuildAmendment,
  GuildAttachment,
  GuildLedgerSpread,
  GuildMemberRecord,
  GuildRecord,
} from "../../data/guildRecords";
import { useAmbientMusic } from "../gallery/AmbientMusic";
import "./GuildLedger.css";

type BookState = "closed" | "opening" | "open" | "closing";
type PageSide = "left" | "right";
type TurnDirection = "forward" | "backward";

type PageTurn = {
  id: number;
  from: number;
  to: number;
  direction: TurnDirection;
  animating: boolean;
};

type GuildRecordsBookProps = {
  guilds: readonly GuildRecord[];
  entryToken?: string;
};

// Serif for headings, guild names and reading text; the sans (Geist) stays on labels and navigation.
const ledgerSerif = EB_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-gl-serif",
});

const SETTINGS_PREFERENCE_KEY = "character-archive-exhibition-settings";
const PAGE_TURN_DURATION = 820;
const PAGE_FLIP_SOUND_SRC = "../effects/page-flip.mp3";
const PAGE_FLIP_VOLUME = 0.5;
// The file opens with ~1s of silence; start playback at the audible part so the
// sound lands with the leaf (the turn itself only lasts PAGE_TURN_DURATION).
const PAGE_FLIP_START_OFFSET = 1;
// Must match --gl-book-open-duration / --gl-book-close-duration in GuildLedger.css.
// The cover's transitionend normally completes the transition; the timeout is only
// a fallback, so it carries a small margin and can never cut the swing short.
const BOOK_OPEN_DURATION = 1100;
const BOOK_CLOSE_DURATION = 950;
const BOOK_TRANSITION_FALLBACK_MARGIN = 150;

function isNonEmpty(value: string | undefined): value is string {
  return Boolean(value?.trim());
}

function guildInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

type PageProps = {
  spread: GuildLedgerSpread;
  spreadIndex: number;
  totalSpreads: number;
  side?: PageSide;
  onSelectGuild: (guildId: string) => void;
  onSelectMember: (guildId: string, memberId: string) => void;
  onReturnToIndex: () => void;
};

function LedgerPage({
  spread,
  spreadIndex,
  totalSpreads,
  side,
  onSelectGuild,
  onSelectMember,
  onReturnToIndex,
}: PageProps) {
  const headingId = useId();
  const folio = `Folio ${String(spreadIndex + 1).padStart(2, "0")} / ${String(
    totalSpreads,
  ).padStart(2, "0")}`;

  const pageClassName = [
    "guildLedgerPaper",
    `guildLedgerPaper--${spread.kind}`,
    side ? `guildLedgerPaper--${side}` : "guildLedgerPaper--mobile",
  ].join(" ");

  const pageHeader = (
    <div className="guildLedgerPageHeader">
      <p className="guildLedgerFolio">{folio}</p>
      {spread.kind !== "index" && (!side || side === "left") && (
        <button
          className="guildLedgerIndexReturn"
          type="button"
          onClick={onReturnToIndex}
        >
          Guild index
        </button>
      )}
    </div>
  );

  if (spread.kind === "index") {
    if (side === "left") {
      return (
        <article className={pageClassName} aria-labelledby={headingId}>
          <div className="guildLedgerPageContent">
            {pageHeader}
            <p className="guildLedgerSectionLabel">Guild register</p>
            <h2 id={headingId}>
              Guild index
            </h2>
            <span className="guildLedgerRule" aria-hidden="true" />
            <p className="guildLedgerLead">
              A directory of the guilds entered in this archive.
            </p>
            <dl className="guildLedgerSummary">
              <div>
                <dt>Guilds entered</dt>
                <dd>{guildsForIndex(spread).length}</dd>
              </div>
              <div>
                <dt>Member records</dt>
                <dd>
                  {guildsForIndex(spread).reduce(
                    (total, guild) => total + guild.members.length,
                    0,
                  )}
                </dd>
              </div>
            </dl>
            <p className="guildLedgerPageColophon">
              Guild Records
              <span>Registry index</span>
            </p>
          </div>
        </article>
      );
    }

    if (side === "right") {
      return (
        <article className={pageClassName} aria-labelledby={headingId}>
          <div className="guildLedgerPageContent">
            {pageHeader}
            <p className="guildLedgerSectionLabel">Contents</p>
            <h2 id={headingId}>
              Register of guilds
            </h2>
            <span className="guildLedgerRule" aria-hidden="true" />
            {guildsForIndex(spread).length > 0 ? (
              <ul className="guildLedgerGuildList">
                {guildsForIndex(spread).map((guild) => (
                  <li key={guild.id}>
                    <button
                      className="guildLedgerGuildEntry"
                      type="button"
                      onClick={() => onSelectGuild(guild.id)}
                    >
                      <span className="guildLedgerEmblem" aria-hidden="true">
                        {guild.emblem ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={guild.emblem.src}
                            alt=""
                            width={1280}
                            height={1280}
                            style={{
                              transform: `scale(${guild.emblemScale ?? 1})`,
                            }}
                          />
                        ) : (
                          guildInitials(guild.name)
                        )}
                      </span>
                      <span className="guildLedgerEntryText">
                        <span className="guildLedgerEntryName">{guild.name}</span>
                        <span className="guildLedgerEntryMeta">
                          {guild.members.length}{" "}
                          {guild.members.length === 1 ? "record" : "records"}
                        </span>
                      </span>
                      <span className="guildLedgerEntryFolio" aria-hidden="true">
                        ›
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="guildLedgerEmptyNote">
                  No guild records have been filed.
              </p>
            )}
          </div>
        </article>
      );
    }

    return (
      <article className={pageClassName} aria-labelledby={headingId}>
        <div className="guildLedgerPageContent guildLedgerPageContent--mobile">
          {pageHeader}
          <p className="guildLedgerSectionLabel">Guild register</p>
          <h2 id={headingId}>
            Guild index
          </h2>
          <span className="guildLedgerRule" aria-hidden="true" />
          <p className="guildLedgerLead">
            A directory of the guilds entered in this archive.
          </p>
          {guildsForIndex(spread).length > 0 ? (
            <ul className="guildLedgerGuildList">
              {guildsForIndex(spread).map((guild) => (
                <li key={guild.id}>
                  <button
                    className="guildLedgerGuildEntry"
                    type="button"
                    onClick={() => onSelectGuild(guild.id)}
                  >
                    <span className="guildLedgerEmblem" aria-hidden="true">
                      {guild.emblem ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={guild.emblem.src}
                          alt=""
                          width={1280}
                          height={1280}
                          style={{
                            transform: `scale(${guild.emblemScale ?? 1})`,
                          }}
                        />
                      ) : (
                        guildInitials(guild.name)
                      )}
                    </span>
                    <span className="guildLedgerEntryText">
                      <span className="guildLedgerEntryName">{guild.name}</span>
                      <span className="guildLedgerEntryMeta">
                        {guild.members.length}{" "}
                        {guild.members.length === 1 ? "record" : "records"}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="guildLedgerEmptyNote">
              No guild records are currently available.
            </p>
          )}
        </div>
      </article>
    );
  }

  if (spread.kind === "guild") {
    const { guild } = spread;

    if (side === "left") {
      return (
        <article className={pageClassName} aria-labelledby={headingId}>
          <div className="guildLedgerPageContent">
            {pageHeader}
            <p className="guildLedgerSectionLabel">Guild record</p>
            {guild.emblem ? (
              <div className="guildLedgerGuildMark">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={guild.emblem.src}
                  alt={guild.emblem.alt ?? `${guild.name} emblem`}
                  width={1280}
                  height={1280}
                  style={{
                    transform: `scale(${guild.emblemScale ?? 1})`,
                  }}
                />
              </div>
            ) : (
              <p className="guildLedgerGuildMonogram" aria-hidden="true">
                {guildInitials(guild.name)}
              </p>
            )}
            <h2 id={headingId}>
              {guild.name}
            </h2>
            <span className="guildLedgerRule" aria-hidden="true" />
            <p className="guildLedgerDescription">
              {isNonEmpty(guild.description)
                ? guild.description
                : "No description has been filed for this guild."}
            </p>
            <p className="guildLedgerPageColophon">
              {guild.members.length}{" "}
              {guild.members.length === 1 ? "member record" : "member records"}
              <span>Guild register</span>
            </p>
          </div>
        </article>
      );
    }

    if (side === "right") {
      return (
        <article className={pageClassName} aria-labelledby={headingId}>
          <div className="guildLedgerPageContent">
            {pageHeader}
            <p className="guildLedgerSectionLabel">Member register</p>
            <h2 id={headingId}>
              Guild records
            </h2>
            <span className="guildLedgerRule" aria-hidden="true" />
            {guild.members.length > 0 ? (
              <ul className="guildLedgerMemberList">
                {guild.members.map((member, index) => (
                  <li key={member.id}>
                    <button
                      className="guildLedgerMemberEntry"
                      type="button"
                      onClick={() => onSelectMember(guild.id, member.id)}
                    >
                      <span className="guildLedgerMemberEntryNumber">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="guildLedgerMemberEntryName">
                        {member.fullName}
                      </span>
                      {isNonEmpty(member.referenceId) && (
                        <span className="guildLedgerMemberEntryReference">
                          {member.referenceId}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="guildLedgerEmptyNote">
                No member records have been filed for this guild.
              </p>
            )}
            <p className="guildLedgerPageColophon">
              {guild.name}
              <span>Member register</span>
            </p>
          </div>
        </article>
      );
    }

    return (
      <article className={pageClassName} aria-labelledby={headingId}>
        <div className="guildLedgerPageContent guildLedgerPageContent--mobile">
          {pageHeader}
          <p className="guildLedgerSectionLabel">Guild record</p>
          {guild.emblem ? (
            <div className="guildLedgerGuildMark">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={guild.emblem.src}
                alt={guild.emblem.alt ?? `${guild.name} emblem`}
                width={1280}
                height={1280}
                style={{
                  transform: `scale(${guild.emblemScale ?? 1})`,
                }}
              />
            </div>
          ) : (
            <p className="guildLedgerGuildMonogram" aria-hidden="true">
              {guildInitials(guild.name)}
            </p>
          )}
          <h2 id={headingId}>
            {guild.name}
          </h2>
          <span className="guildLedgerRule" aria-hidden="true" />
          <p className="guildLedgerDescription">
            {isNonEmpty(guild.description)
              ? guild.description
              : "No description has been filed for this guild."}
          </p>
          <h3 className="guildLedgerSubheading">Member register</h3>
          {guild.members.length > 0 ? (
            <ul className="guildLedgerMemberList">
              {guild.members.map((member, index) => (
                <li key={member.id}>
                  <button
                    className="guildLedgerMemberEntry"
                    type="button"
                    onClick={() => onSelectMember(guild.id, member.id)}
                  >
                    <span className="guildLedgerMemberEntryNumber">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="guildLedgerMemberEntryName">
                      {member.fullName}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="guildLedgerEmptyNote">
              No member records have been filed for this guild.
            </p>
          )}
        </div>
      </article>
    );
  }

  if (spread.kind === "member") {
    const { guild, member } = spread;

    if (side === "left") {
      return (
        <article className={pageClassName} aria-labelledby={headingId}>
          <div className="guildLedgerPageContent">
            {pageHeader}
            <p className="guildLedgerSectionLabel">Member portrait</p>
            <h2 className="guildLedgerPortraitHeading" id={headingId}>
              {member.fullName}
            </h2>
            <figure className="guildLedgerPortrait">
              {member.portrait ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="guildLedgerPortraitImage"
                  src={member.portrait.src}
                  alt={member.portrait.alt ?? member.fullName}
                  width={1080}
                  height={1080}
                  loading="lazy"
                  data-fit={member.portrait.fit ?? "contain"}
                />
              ) : (
                <figcaption className="guildLedgerPortraitMissing">
                  Portrait not filed
                </figcaption>
              )}
              {member.portrait && member.portrait.alt && (
                <figcaption className="guildLedgerPortraitCaption">
                  {member.portrait.alt}
                </figcaption>
              )}
            </figure>
            <p className="guildLedgerPortraitAffiliation">{guild.name}</p>
            {isNonEmpty(member.referenceId) && (
              <p className="guildLedgerReferenceNote">
                Reference: {member.referenceId}
              </p>
            )}
          </div>
        </article>
      );
    }

    if (side === "right") {
      return (
        <article className={pageClassName} aria-labelledby={headingId}>
          <div className="guildLedgerPageContent">
            {pageHeader}
            <p className="guildLedgerSectionLabel">Registration record</p>
            <h2 id={headingId}>
              {member.fullName}
            </h2>
            <span className="guildLedgerRule" aria-hidden="true" />
            <dl className="guildLedgerFields">
              {isNonEmpty(member.registeredTitle) && (
                <div>
                  <dt>Registered title</dt>
                  <dd>{member.registeredTitle}</dd>
                </div>
              )}
              <div>
                <dt>Guild affiliation</dt>
                <dd>{guild.name}</dd>
              </div>
              {isNonEmpty(member.rank) && (
                <div>
                  <dt>Rank</dt>
                  <dd>{member.rank}</dd>
                </div>
              )}
              {isNonEmpty(member.registrationDate) && (
                <div>
                  <dt>Registration date</dt>
                  <dd>{member.registrationDate}</dd>
                </div>
              )}
              {isNonEmpty(member.referenceId) && (
                <div>
                  <dt>Record reference</dt>
                  <dd>{member.referenceId}</dd>
                </div>
              )}
              {isNonEmpty(member.status) && (
                <div>
                  <dt>Status</dt>
                  <dd>{member.status}</dd>
                </div>
              )}
            </dl>
            {isNonEmpty(member.description) && (
              <p className="guildLedgerDescription">{member.description}</p>
            )}
            {isNonEmpty(member.remarks) && (
              <p className="guildLedgerHandnote">{member.remarks}</p>
            )}
            {memberIsEmpty(member) && (
              <p className="guildLedgerEmptyNote">
                No registration details are currently filed.
              </p>
            )}
            <p className="guildLedgerPageColophon">
              {guild.name}
              <span>Registration record</span>
            </p>
          </div>
        </article>
      );
    }

    return (
      <article className={pageClassName} aria-labelledby={headingId}>
        <div className="guildLedgerPageContent guildLedgerPageContent--mobile">
          {pageHeader}
          <p className="guildLedgerSectionLabel">Member record</p>
          <h2 id={headingId}>
            {member.fullName}
          </h2>
          <figure className="guildLedgerPortrait guildLedgerPortrait--mobile">
            {member.portrait ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="guildLedgerPortraitImage"
                src={member.portrait.src}
                alt={member.portrait.alt ?? member.fullName}
                width={1080}
                height={1080}
                loading="lazy"
                data-fit={member.portrait.fit ?? "contain"}
              />
            ) : (
              <figcaption className="guildLedgerPortraitMissing">
                Portrait not filed
              </figcaption>
            )}
          </figure>
          <span className="guildLedgerRule" aria-hidden="true" />
          <dl className="guildLedgerFields">
            {isNonEmpty(member.registeredTitle) && (
              <div>
                <dt>Registered title</dt>
                <dd>{member.registeredTitle}</dd>
              </div>
            )}
            <div>
              <dt>Guild affiliation</dt>
              <dd>{guild.name}</dd>
            </div>
            {isNonEmpty(member.rank) && (
              <div>
                <dt>Rank</dt>
                <dd>{member.rank}</dd>
              </div>
            )}
            {isNonEmpty(member.registrationDate) && (
              <div>
                <dt>Registration date</dt>
                <dd>{member.registrationDate}</dd>
              </div>
            )}
            {isNonEmpty(member.referenceId) && (
              <div>
                <dt>Record reference</dt>
                <dd>{member.referenceId}</dd>
              </div>
            )}
            {isNonEmpty(member.status) && (
              <div>
                <dt>Status</dt>
                <dd>{member.status}</dd>
              </div>
            )}
          </dl>
          {isNonEmpty(member.description) && (
            <p className="guildLedgerDescription">{member.description}</p>
          )}
          {isNonEmpty(member.remarks) && (
            <p className="guildLedgerHandnote">{member.remarks}</p>
          )}
        </div>
      </article>
    );
  }

  const {
    guild,
    member,
    part,
    parts,
    amendments,
    annotations,
    attachments,
  } = spread;
  const leftHasContent =
    amendments.length > 0 ||
    (amendments.length === 0 && annotations.length > 0);
  const rightHasContent =
    (amendments.length > 0 && annotations.length > 0) ||
    attachments.length > 0;

  if (side === "left") {
    return (
      <article
        className={pageClassName}
        aria-labelledby={leftHasContent ? headingId : undefined}
        aria-label={!leftHasContent ? "Continuation page" : undefined}
      >
        <div className="guildLedgerPageContent">
          {pageHeader}
          {leftHasContent && (
            <>
              <p className="guildLedgerSectionLabel">
                Supplementary record {part} of {parts}
              </p>
              <h2 id={headingId}>
                {amendments.length > 0 ? "Record amendments" : "Annotations"}
              </h2>
              <span className="guildLedgerRule" aria-hidden="true" />
              <p className="guildLedgerContextLine">{member.fullName}</p>
              {amendments.length > 0 ? (
                <AmendmentList amendments={amendments} />
              ) : (
                <AnnotationList annotations={annotations} />
              )}
            </>
          )}
          {leftHasContent && (
            <p className="guildLedgerPageColophon">{guild.name}</p>
          )}
        </div>
      </article>
    );
  }

  if (side === "right") {
    return (
      <article
        className={pageClassName}
        aria-labelledby={rightHasContent ? headingId : undefined}
        aria-label={!rightHasContent ? "Continuation page" : undefined}
      >
        <div className="guildLedgerPageContent">
          {pageHeader}
          {rightHasContent && (
            <>
              <p className="guildLedgerSectionLabel">
                Supplementary record {part} of {parts}
              </p>
              <h2 id={headingId}>
                {amendments.length > 0 ? "Marginalia" : "Attachments"}
              </h2>
              <span className="guildLedgerRule" aria-hidden="true" />
              {amendments.length > 0 && annotations.length > 0 && (
                <section
                  className="guildLedgerSupplementSection"
                  aria-label="Annotations"
                >
                  <h3>Annotations</h3>
                  <AnnotationList annotations={annotations} />
                </section>
              )}
              {attachments.length > 0 && (
                <section
                  className="guildLedgerSupplementSection"
                  aria-label="Attachments"
                >
                  <h3>Attachments</h3>
                  <ul className="guildLedgerAttachmentList">
                    {attachments.map((attachment) => (
                      <li key={attachment.id}>
                        <AttachmentEntry attachment={attachment} />
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
          {rightHasContent && (
            <p className="guildLedgerPageColophon">{member.fullName}</p>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className={pageClassName} aria-labelledby={headingId}>
      <div className="guildLedgerPageContent guildLedgerPageContent--mobile">
        {pageHeader}
        <p className="guildLedgerSectionLabel">
          Supplementary record {part} of {parts}
        </p>
        <h2 id={headingId}>
          Marginalia
        </h2>
        <span className="guildLedgerRule" aria-hidden="true" />
        <p className="guildLedgerContextLine">
          {member.fullName} · {guild.name}
        </p>
        {amendments.length > 0 && (
          <section className="guildLedgerSupplementSection">
            <h3>Amendments</h3>
            <AmendmentList amendments={amendments} />
          </section>
        )}
        {annotations.length > 0 && (
          <section className="guildLedgerSupplementSection">
            <h3>Annotations</h3>
            <AnnotationList annotations={annotations} />
          </section>
        )}
        {attachments.length > 0 && (
          <section className="guildLedgerSupplementSection">
            <h3>Attachments</h3>
            <ul className="guildLedgerAttachmentList">
              {attachments.map((attachment) => (
                <li key={attachment.id}>
                  <AttachmentEntry attachment={attachment} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </article>
  );
}

function guildsForIndex(spread: GuildLedgerSpread): readonly GuildRecord[] {
  return spread.kind === "index" ? spread.guilds : [];
}

function memberIsEmpty(member: GuildMemberRecord): boolean {
  return (
    !isNonEmpty(member.registeredTitle) &&
    !isNonEmpty(member.rank) &&
    !isNonEmpty(member.registrationDate) &&
    !isNonEmpty(member.referenceId) &&
    !isNonEmpty(member.status) &&
    !isNonEmpty(member.description) &&
    !isNonEmpty(member.remarks)
  );
}

function AmendmentList({ amendments }: { amendments: readonly GuildAmendment[] }) {
  return (
    <ol className="guildLedgerAmendmentList">
      {amendments.map((amendment) => (
        <li key={amendment.id}>
          {isNonEmpty(amendment.date) && (
            <p className="guildLedgerAmendmentDate">{amendment.date}</p>
          )}
          <p>{amendment.correction}</p>
          {isNonEmpty(amendment.initials) && (
            <p className="guildLedgerAmendmentInitials">{amendment.initials}</p>
          )}
        </li>
      ))}
    </ol>
  );
}

function AnnotationList({ annotations }: { annotations: readonly string[] }) {
  return (
    <ul className="guildLedgerAnnotationList">
      {annotations.map((annotation, index) => (
        <li key={`${index}-${annotation}`}>{annotation}</li>
      ))}
    </ul>
  );
}

function AttachmentEntry({ attachment }: { attachment: GuildAttachment }) {
  const content = (
    <>
      <span className="guildLedgerAttachmentTitle">{attachment.title}</span>
      {isNonEmpty(attachment.description) && (
        <span className="guildLedgerAttachmentDescription">
          {attachment.description}
        </span>
      )}
    </>
  );

  return attachment.href ? (
    <a className="guildLedgerAttachment" href={attachment.href}>
      {content}
    </a>
  ) : (
    <div className="guildLedgerAttachment">{content}</div>
  );
}

type SpreadSurfaceProps = {
  leftSpread: GuildLedgerSpread;
  rightSpread: GuildLedgerSpread;
  leftIndex: number;
  rightIndex: number;
  totalSpreads: number;
  mobileSpread: GuildLedgerSpread;
  mobileIndex: number;
  inert: boolean;
  onSelectGuild: (guildId: string) => void;
  onSelectMember: (guildId: string, memberId: string) => void;
  onReturnToIndex: () => void;
};

function SpreadSurface({
  leftSpread,
  rightSpread,
  leftIndex,
  rightIndex,
  totalSpreads,
  mobileSpread,
  mobileIndex,
  inert,
  onSelectGuild,
  onSelectMember,
  onReturnToIndex,
}: SpreadSurfaceProps) {
  const pageProps = {
    totalSpreads,
    onSelectGuild,
    onSelectMember,
    onReturnToIndex,
  };

  return (
    <div className="guildLedgerSpread" aria-hidden={inert} inert={inert}>
      <div className="guildLedgerSpreadDesktop">
        <LedgerPage
          {...pageProps}
          spread={leftSpread}
          spreadIndex={leftIndex}
          side="left"
        />
        <span className="guildLedgerGutter" aria-hidden="true" />
        <LedgerPage
          {...pageProps}
          spread={rightSpread}
          spreadIndex={rightIndex}
          side="right"
        />
      </div>
      <div className="guildLedgerSpreadMobile">
        <LedgerPage
          {...pageProps}
          spread={mobileSpread}
          spreadIndex={mobileIndex}
        />
      </div>
    </div>
  );
}

export default function GuildRecordsBook({
  guilds,
  entryToken,
}: GuildRecordsBookProps) {
  const { setBookMuffled } = useAmbientMusic();
  const router = useRouter();
  const spreads = useMemo(() => buildGuildLedgerSpreads(guilds), [guilds]);
  const spreadIndices = useMemo(
    () => new Map(spreads.map((spread, index) => [spread.id, index])),
    [spreads],
  );
  const [bookState, setBookState] = useState<BookState>("closed");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [motionPreferenceLoaded, setMotionPreferenceLoaded] = useState(false);
  const [currentSpreadIndex, setCurrentSpreadIndex] = useState(0);
  const activeSpreadIndex = Math.min(currentSpreadIndex, spreads.length - 1);
  const [turn, setTurn] = useState<PageTurn | null>(null);
  const coverRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const pageStatusRef = useRef<HTMLSpanElement>(null);
  const bookTransitionTimeout = useRef<number | null>(null);
  const pageTurnTimeout = useRef<number | null>(null);
  const pageTurnFrame = useRef<number | null>(null);
  const turnRef = useRef<PageTurn | null>(null);
  const turnSequence = useRef(0);
  const previousBookState = useRef<BookState>("closed");
  const autoOpenHandled = useRef<string | null>(null);
  const pageFlipAudio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const motionPreference = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    const updatePreference = () => {
      let savedPreference = false;
      try {
        const storedSettings = window.localStorage.getItem(
          SETTINGS_PREFERENCE_KEY,
        );
        if (storedSettings) {
          const parsed: unknown = JSON.parse(storedSettings);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Expected exhibition settings to be an object.");
          }
          savedPreference =
            (parsed as Record<string, unknown>).reducedMotion === true;
        }
      } catch (error) {
        console.warn(
          "Could not read the exhibition reduced-motion preference.",
          error,
        );
      }

      setReducedMotion(motionPreference.matches || savedPreference);
    };

    updatePreference();
    const preferenceFrame = window.requestAnimationFrame(() =>
      setMotionPreferenceLoaded(true),
    );
    motionPreference.addEventListener("change", updatePreference);
    window.addEventListener("storage", updatePreference);
    return () => {
      window.cancelAnimationFrame(preferenceFrame);
      motionPreference.removeEventListener("change", updatePreference);
      window.removeEventListener("storage", updatePreference);
    };
  }, []);

  const finishBookTransition = useCallback((from: "opening" | "closing") => {
    if (bookTransitionTimeout.current !== null) {
      window.clearTimeout(bookTransitionTimeout.current);
      bookTransitionTimeout.current = null;
    }

    const next = from === "opening" ? "open" : "closed";
    setBookState((current) => (current === from ? next : current));
  }, []);

  // Separate from the ambient music element, so music and its controls are untouched.
  // Restarting the same element keeps rapid turns from stacking into overlapping playback.
  const getPageFlipAudio = useCallback(() => {
    if (!pageFlipAudio.current) {
      const audio = new Audio(PAGE_FLIP_SOUND_SRC);
      audio.volume = PAGE_FLIP_VOLUME;
      audio.preload = "auto";
      pageFlipAudio.current = audio;
    }
    return pageFlipAudio.current;
  }, []);

  const playPageFlip = useCallback(() => {
    try {
      const audio = getPageFlipAudio();
      audio.currentTime = PAGE_FLIP_START_OFFSET;
      void audio.play().catch(() => {});
    } catch {
      // Sound is decorative; never let it break page turning.
    }
  }, [getPageFlipAudio]);

  // Buffer the effect up front so the first turn isn't silent while it loads.
  useEffect(() => {
    getPageFlipAudio();
  }, [getPageFlipAudio]);

  const finishPageTurn = useCallback(() => {
    const activeTurn = turnRef.current;
    if (!activeTurn) return;

    if (pageTurnTimeout.current !== null) {
      window.clearTimeout(pageTurnTimeout.current);
      pageTurnTimeout.current = null;
    }
    if (pageTurnFrame.current !== null) {
      window.cancelAnimationFrame(pageTurnFrame.current);
      pageTurnFrame.current = null;
    }

    setCurrentSpreadIndex(activeTurn.to);
    turnRef.current = null;
    setTurn(null);
    window.requestAnimationFrame(() => pageStatusRef.current?.focus());
  }, []);

  useEffect(() => {
    const previous = previousBookState.current;
    if (bookState === "open" && previous === "opening") closeRef.current?.focus();
    else if (bookState === "closed" && previous === "closing")
      coverRef.current?.focus();
    previousBookState.current = bookState;
  }, [bookState]);

  useEffect(
    () => () => {
      setBookMuffled(false);
      if (bookTransitionTimeout.current !== null) {
        window.clearTimeout(bookTransitionTimeout.current);
      }
      if (pageTurnTimeout.current !== null) {
        window.clearTimeout(pageTurnTimeout.current);
      }
      if (pageTurnFrame.current !== null) {
        window.cancelAnimationFrame(pageTurnFrame.current);
      }
      pageFlipAudio.current?.pause();
      pageFlipAudio.current = null;
    },
    [setBookMuffled],
  );

  const beginOpening = useCallback(() => {
    if (bookState !== "closed") return;
    setBookMuffled(true);
    setBookState("opening");

    if (
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      window.requestAnimationFrame(() => finishBookTransition("opening"));
      return;
    }

    bookTransitionTimeout.current = window.setTimeout(
      () => finishBookTransition("opening"),
      BOOK_OPEN_DURATION + BOOK_TRANSITION_FALLBACK_MARGIN,
    );
  }, [bookState, finishBookTransition, reducedMotion, setBookMuffled]);

  useEffect(() => {
    if (
      !motionPreferenceLoaded ||
      !entryToken ||
      autoOpenHandled.current === entryToken ||
      bookState !== "closed"
    ) {
      return;
    }

    autoOpenHandled.current = entryToken;
    beginOpening();
    router.replace("/guild-records", { scroll: false });
  }, [beginOpening, bookState, entryToken, motionPreferenceLoaded, router]);

  const beginClosing = () => {
    if (bookState !== "open" || turnRef.current) return;
    setBookMuffled(false);
    setBookState("closing");

    if (
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      window.requestAnimationFrame(() => finishBookTransition("closing"));
      return;
    }

    bookTransitionTimeout.current = window.setTimeout(
      () => finishBookTransition("closing"),
      BOOK_CLOSE_DURATION + BOOK_TRANSITION_FALLBACK_MARGIN,
    );
  };

  const beginPageTurn = useCallback(
    (targetIndex: number) => {
      if (
        bookState !== "open" ||
        turnRef.current ||
        targetIndex < 0 ||
        targetIndex >= spreads.length ||
        targetIndex === activeSpreadIndex
      ) {
        return;
      }

      const nextTurn: PageTurn = {
        id: ++turnSequence.current,
        from: activeSpreadIndex,
        to: targetIndex,
        direction:
          targetIndex > activeSpreadIndex ? "forward" : "backward",
        animating: false,
      };

      turnRef.current = nextTurn;
      setTurn(nextTurn);

      if (
        reducedMotion ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        pageTurnTimeout.current = window.setTimeout(finishPageTurn, 0);
        return;
      }

      playPageFlip();
      pageTurnFrame.current = window.requestAnimationFrame(() => {
        setTurn((current) =>
          current?.id === nextTurn.id
            ? { ...current, animating: true }
            : current,
        );
      });
      pageTurnTimeout.current = window.setTimeout(
        finishPageTurn,
        PAGE_TURN_DURATION + 120,
      );
    },
    [
      activeSpreadIndex,
      bookState,
      finishPageTurn,
      playPageFlip,
      reducedMotion,
      spreads.length,
    ],
  );

  const handleBookTransitionEnd = (event: TransitionEvent<HTMLButtonElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform")
      return;
    if (bookState === "opening") finishBookTransition("opening");
    else if (bookState === "closing") finishBookTransition("closing");
  };

  const handlePageTurnTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform")
      return;
    finishPageTurn();
  };

  const navigateToGuild = (guildId: string) => {
    const targetIndex = spreadIndices.get(getGuildSpreadId(guildId));
    if (targetIndex !== undefined) beginPageTurn(targetIndex);
  };

  const navigateToMember = (guildId: string, memberId: string) => {
    const targetIndex = spreadIndices.get(
      getMemberSpreadId(guildId, memberId),
    );
    if (targetIndex !== undefined) beginPageTurn(targetIndex);
  };

  const navigateToIndex = () => beginPageTurn(0);
  const currentSpread = spreads[activeSpreadIndex] ?? {
    id: "index",
    kind: "index" as const,
    guilds,
  };
  const fromSpread = turn
    ? (spreads[turn.from] ?? currentSpread)
    : currentSpread;
  const targetSpread = turn
    ? (spreads[turn.to] ?? currentSpread)
    : currentSpread;
  const baseLeftSpread =
    turn?.direction === "backward" ? targetSpread : fromSpread;
  const baseRightSpread =
    turn?.direction === "forward" ? targetSpread : fromSpread;
  const isOpen = bookState === "open";

  return (
    <div
      className={`guildLedgerVolume ${ledgerSerif.variable}`}
      data-book-state={bookState}
      data-reduced-motion={reducedMotion}
      data-turn-direction={turn?.direction ?? "none"}
    >
      <div className="guildLedgerBackCover" aria-hidden="true" />
      <div className="guildLedgerPageBlock" aria-hidden="true" />
      <div className="guildLedgerLeftBlock" aria-hidden="true" />

      <div
        id="guild-records-interior"
        className="guildLedgerInterior"
        aria-hidden={!isOpen}
        inert={!isOpen}
      >
        <SpreadSurface
          leftSpread={baseLeftSpread}
          rightSpread={baseRightSpread}
          leftIndex={
            turn?.direction === "backward"
              ? turn.to
              : turn?.from ?? activeSpreadIndex
          }
          rightIndex={
            turn?.direction === "forward"
              ? turn.to
              : turn?.from ?? activeSpreadIndex
          }
          totalSpreads={spreads.length}
          mobileSpread={turn ? targetSpread : currentSpread}
          mobileIndex={turn ? turn.to : activeSpreadIndex}
          inert={Boolean(turn)}
          onSelectGuild={navigateToGuild}
          onSelectMember={navigateToMember}
          onReturnToIndex={navigateToIndex}
        />

        {turn && (
          <div
            className={`guildLedgerTurnLeaf guildLedgerTurnLeaf--${turn.direction}`}
            data-animating={turn.animating}
            aria-hidden="true"
            inert
            onTransitionEnd={handlePageTurnTransitionEnd}
          >
            <div className="guildLedgerTurnFace guildLedgerTurnFace--front">
              <div className="guildLedgerTurnDesktop">
                <LedgerPage
                  spread={fromSpread}
                  spreadIndex={turn.from}
                  totalSpreads={spreads.length}
                  side={turn.direction === "forward" ? "right" : "left"}
                  onSelectGuild={navigateToGuild}
                  onSelectMember={navigateToMember}
                  onReturnToIndex={navigateToIndex}
                />
              </div>
              <div className="guildLedgerTurnMobile">
                <LedgerPage
                  spread={fromSpread}
                  spreadIndex={turn.from}
                  totalSpreads={spreads.length}
                  onSelectGuild={navigateToGuild}
                  onSelectMember={navigateToMember}
                  onReturnToIndex={navigateToIndex}
                />
              </div>
            </div>
            <div className="guildLedgerTurnFace guildLedgerTurnFace--back">
              <div className="guildLedgerTurnDesktop">
                <LedgerPage
                  spread={targetSpread}
                  spreadIndex={turn.to}
                  totalSpreads={spreads.length}
                  side={turn.direction === "forward" ? "left" : "right"}
                  onSelectGuild={navigateToGuild}
                  onSelectMember={navigateToMember}
                  onReturnToIndex={navigateToIndex}
                />
              </div>
              <div className="guildLedgerTurnMobile">
                <LedgerPage
                  spread={targetSpread}
                  spreadIndex={turn.to}
                  totalSpreads={spreads.length}
                  onSelectGuild={navigateToGuild}
                  onSelectMember={navigateToMember}
                  onReturnToIndex={navigateToIndex}
                />
              </div>
            </div>
          </div>
        )}

        <span className="guildLedgerRibbon" aria-hidden="true" />

        <nav className="guildLedgerControls" aria-label="Guild ledger navigation">
          <button
            className="guildLedgerTurnButton"
            type="button"
            aria-label="Previous folio"
            disabled={!isOpen || Boolean(turn) || activeSpreadIndex === 0}
            onClick={() => beginPageTurn(activeSpreadIndex - 1)}
          >
            <span aria-hidden="true">‹</span>
            <span className="guildLedgerControlLabel">Previous folio</span>
          </button>
          <span
            ref={pageStatusRef}
            className="guildLedgerPageStatus"
            tabIndex={-1}
            aria-live="polite"
          >
            {activeSpreadIndex + 1} of {spreads.length}
          </span>
          <button
            className="guildLedgerTurnButton"
            type="button"
            aria-label="Next folio"
            disabled={
              !isOpen ||
              Boolean(turn) ||
              activeSpreadIndex >= spreads.length - 1
            }
            onClick={() => beginPageTurn(activeSpreadIndex + 1)}
          >
            <span className="guildLedgerControlLabel">Next folio</span>
            <span aria-hidden="true">›</span>
          </button>
          <button
            ref={closeRef}
            className="guildLedgerCloseButton"
            type="button"
            disabled={!isOpen || Boolean(turn)}
            onClick={beginClosing}
          >
            Close ledger
          </button>
        </nav>
      </div>

      <span className="guildLedgerSpine" aria-hidden="true" />
      <button
        ref={coverRef}
        className="guildLedgerCover"
        type="button"
        aria-label="Open Guild Records ledger"
        aria-expanded={isOpen}
        aria-controls="guild-records-interior"
        disabled={bookState !== "closed"}
        onClick={beginOpening}
        onTransitionEnd={handleBookTransitionEnd}
      >
        <span className="guildLedgerCoverBack" aria-hidden="true" />
        <span className="guildLedgerCoverBorder" aria-hidden="true" />
        <span className="guildLedgerCoverInsignia" aria-hidden="true">
          <span>✦</span>
        </span>
        <span className="guildLedgerCoverKicker">Official archive</span>
        <span className="guildLedgerCoverTitle">Guild Records</span>
        <span className="guildLedgerCoverRule" aria-hidden="true" />
        <span className="guildLedgerCoverSubtitle">Registration ledger</span>
      </button>
    </div>
  );
}