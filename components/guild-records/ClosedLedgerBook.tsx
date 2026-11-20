"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { TransitionEvent } from "react";
import "./ClosedLedger.css";

type Props = {
  href?: string;
};

type BookState = "closed" | "opening" | "open" | "closing";

const SETTINGS_PREFERENCE_KEY = "character-archive-exhibition-settings";

export default function ClosedLedgerBook({ href }: Props) {
  const [bookState, setBookState] = useState<BookState>("closed");
  const [reducedMotion, setReducedMotion] = useState(false);
  const coverRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const transitionTimeout = useRef<number | null>(null);
  const previousBookState = useRef<BookState>("closed");
  const isLandingLink = Boolean(href);

  const finishTransition = useCallback((from: "opening" | "closing") => {
    if (transitionTimeout.current !== null) {
      window.clearTimeout(transitionTimeout.current);
      transitionTimeout.current = null;
    }

    const next = from === "opening" ? "open" : "closed";
    setBookState((current) => (current === from ? next : current));
  }, []);

  useEffect(() => {
    const previous = previousBookState.current;
    if (bookState === "open" && previous === "opening") closeRef.current?.focus();
    else if (bookState === "closed" && previous === "closing") coverRef.current?.focus();
    previousBookState.current = bookState;
  }, [bookState]);

  useEffect(
    () => () => {
      if (transitionTimeout.current !== null) window.clearTimeout(transitionTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (isLandingLink) return;

    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updatePreference = () => {
      let savedPreference = false;
      try {
        const storedSettings = window.localStorage.getItem(SETTINGS_PREFERENCE_KEY);
        if (storedSettings) {
          const parsed: unknown = JSON.parse(storedSettings);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            throw new Error("Expected exhibition settings to be an object.");
          }
          savedPreference = (parsed as Record<string, unknown>).reducedMotion === true;
        }
      } catch (error) {
        console.warn("Could not read the exhibition reduced-motion preference.", error);
      }

      setReducedMotion(motionPreference.matches || savedPreference);
    };

    updatePreference();
    motionPreference.addEventListener("change", updatePreference);
    window.addEventListener("storage", updatePreference);
    return () => {
      motionPreference.removeEventListener("change", updatePreference);
      window.removeEventListener("storage", updatePreference);
    };
  }, [isLandingLink]);

  const beginOpening = () => {
    if (bookState !== "closed") return;
    setBookState("opening");

    if (reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.requestAnimationFrame(() => finishTransition("opening"));
      return;
    }

    transitionTimeout.current = window.setTimeout(() => finishTransition("opening"), 900);
  };

  const beginClosing = () => {
    if (bookState !== "open") return;
    setBookState("closing");

    if (reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.requestAnimationFrame(() => finishTransition("closing"));
      return;
    }

    transitionTimeout.current = window.setTimeout(() => finishTransition("closing"), 900);
  };

  const handleCoverTransitionEnd = (event: TransitionEvent<HTMLButtonElement>) => {
    if (event.target !== event.currentTarget || event.propertyName !== "transform") return;
    if (bookState === "opening") finishTransition("opening");
    else if (bookState === "closing") finishTransition("closing");
  };

  const coverContent = (
    <>
      <span className="guildRecordsCoverBorder" aria-hidden="true" />
      <span className="guildRecordsCoverInner" aria-hidden="true" />
      <span className="guildRecordsCoverContent" aria-hidden="true">
        <span className="guildRecordsCoverKicker">Official archive</span>
        <span className="guildRecordsInsignia">
          <svg viewBox="0 0 64 64" focusable="false">
            <path d="M32 12 47 32 32 52 17 32 32 12Z" />
            <path d="M32 20v24M20 32h24" />
            <circle cx="32" cy="32" r="4" />
          </svg>
        </span>
        <span className="guildRecordsCoverTitle">Guild Records</span>
        <span className="guildRecordsCoverRule" />
        <span className="guildRecordsCoverSubtitle">Registration ledger</span>
      </span>
    </>
  );

  return (
    <div
      className="guildRecordsBook"
      data-book-state={isLandingLink ? "closed" : bookState}
      data-book-variant={isLandingLink ? "landing" : "full"}
      data-reduced-motion={reducedMotion}
    >
      {!isLandingLink && (
        <div
          id="guild-records-interior"
          className="guildRecordsSpread"
          aria-hidden={bookState !== "open"}
          inert={bookState !== "open"}
        >
          <article className="guildRecordsPaper guildRecordsLeftPage">
            <div className="guildRecordsPaperContent">
              <p className="guildRecordsFolio">Official entry</p>
              <h2>Registration details</h2>
              <span className="guildRecordsPaperRule" aria-hidden="true" />
              <dl className="guildRecordsFields">
                <div>
                  <dt>Guild name</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
                <div>
                  <dt>Registered title</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
                <div>
                  <dt>Rank</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
                <div>
                  <dt>Registration date</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
                <div>
                  <dt>Record reference</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
              </dl>
              <p className="guildRecordsHandnote">No registration details filed.</p>
              <p className="guildRecordsPaperFooter">Guild records / registration ledger</p>
            </div>
          </article>

          <span className="guildRecordsGutter" aria-hidden="true" />

          <article className="guildRecordsPaper guildRecordsRightPage">
            <div className="guildRecordsPaperContent">
              <div className="guildRecordsFolioRow">
                <p className="guildRecordsFolio">Margin / continued</p>
                <button
                  ref={closeRef}
                  className="guildRecordsCloseButton"
                  type="button"
                  disabled={bookState !== "open"}
                  onClick={beginClosing}
                >
                  Close ledger
                </button>
              </div>
              <h2>Annotations &amp; amendments</h2>
              <span className="guildRecordsPaperRule" aria-hidden="true" />
              <section className="guildRecordsAmendments" aria-labelledby="guild-records-amendments">
                <h3 id="guild-records-amendments">Amendments</h3>
                <div className="guildRecordsAmendmentLine">
                  <span>Date</span>
                  <span aria-hidden="true" />
                </div>
                <div className="guildRecordsAmendmentLine">
                  <span>Correction</span>
                  <span aria-hidden="true" />
                </div>
                <div className="guildRecordsAmendmentLine">
                  <span>Initials</span>
                  <span aria-hidden="true" />
                </div>
              </section>
              <p className="guildRecordsHandnote">Margin reserved for corrections.</p>
              <section className="guildRecordsAttachments" aria-labelledby="guild-records-attachments">
                <h3 id="guild-records-attachments">Attachments</h3>
                <p>No attachments filed.</p>
              </section>
              <p className="guildRecordsPaperFooter">Annotations / amendments</p>
            </div>
          </article>

          <article className="guildRecordsPaper guildRecordsMobilePage">
            <div className="guildRecordsPaperContent">
              <div className="guildRecordsFolioRow">
                <p className="guildRecordsFolio">Official archive</p>
                <button
                  className="guildRecordsCloseButton"
                  type="button"
                  disabled={bookState !== "open"}
                  onClick={beginClosing}
                >
                  Close
                </button>
              </div>
              <h2>Registration details</h2>
              <span className="guildRecordsPaperRule" aria-hidden="true" />
              <dl className="guildRecordsFields">
                <div>
                  <dt>Guild name</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
                <div>
                  <dt>Registered title</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
                <div>
                  <dt>Rank</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
                <div>
                  <dt>Registration date</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
                <div>
                  <dt>Record reference</dt>
                  <dd aria-label="Not recorded">—</dd>
                </div>
              </dl>
              <section className="guildRecordsMobileNotes">
                <h3>Annotations &amp; amendments</h3>
                <p className="guildRecordsHandnote">Margin reserved for corrections.</p>
                <h3>Attachments</h3>
                <p>No attachments filed.</p>
              </section>
              <p className="guildRecordsPaperFooter">Guild records / registration ledger</p>
            </div>
          </article>
        </div>
      )}

      <span className="guildRecordsBookmark" aria-hidden="true" />
      <span className="guildRecordsPages" aria-hidden="true" />
      {href ? (
        <Link
          className="guildRecordsCover"
          href={href}
          aria-label="Enter Guild Records"
          title="Enter Guild Records"
        >
          {coverContent}
        </Link>
      ) : (
        <button
          ref={coverRef}
          className="guildRecordsCover"
          type="button"
          aria-label={bookState === "closed" ? "Open Guild Records ledger" : "Guild Records ledger cover"}
          aria-expanded={bookState === "open"}
          aria-controls="guild-records-interior"
          disabled={bookState === "opening" || bookState === "closing"}
          tabIndex={bookState === "open" || bookState === "closing" ? -1 : 0}
          onClick={beginOpening}
          onTransitionEnd={handleCoverTransitionEnd}
        >
          {coverContent}
        </button>
      )}
      <span className="guildRecordsSpine" aria-hidden="true" />
    </div>
  );
}
