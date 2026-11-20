import { useState } from "react";
import type { CSSProperties, MouseEvent } from "react";

type Props = {
  open: boolean;
  portraitId: string;
};

const documents = [
  {
    title: "Character profile",
    category: "Identity",
    empty: "Identity details have not been added to this record.",
  },
  {
    title: "Background",
    category: "History",
    empty: "No background material has been filed for this character.",
  },
  {
    title: "Chronology",
    category: "Timeline",
    empty: "No dated events have been added to this chronology.",
  },
  {
    title: "Associations",
    category: "Connections",
    empty: "No relationship records have been filed.",
  },
  {
    title: "Field notes",
    category: "Observations",
    empty: "No marginal notes have been recorded.",
  },
] as const;

export default function Dossier({ open, portraitId }: Props) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeDocument = documents[activeIndex];

  const selectDocument = (index: number) => (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setActiveIndex(index);
  };

  return (
    <aside
      className="pf-dossier"
      data-open={open}
      aria-hidden={!open}
      aria-label="Character archive documents"
      inert={!open}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="pf-dossier-stack">
        <div className="pf-paper-stack" aria-label="Document stack">
          {documents.map((document, index) => {
            const depth = (index - activeIndex + documents.length) % documents.length;
            const active = depth === 0;
            return (
              <button
                key={document.category}
                type="button"
                className="pf-paper"
                style={{ "--depth": depth } as CSSProperties}
                data-active={active}
                aria-label={`${document.category}: ${document.title}`}
                aria-pressed={active}
                onFocus={() => setActiveIndex(index)}
                onClick={selectDocument(index)}
              >
                <span className="pf-paper-content" aria-hidden={!active}>
                  <span className="pf-paper-kicker">
                    <span>Character archive</span>
                    <span>{String(index + 1).padStart(2, "0")} / {String(documents.length).padStart(2, "0")}</span>
                  </span>
                  <span className="pf-paper-rule" />
                  <span className="pf-paper-category">{document.category} record</span>
                  <span className="pf-paper-title">{document.title}</span>
                  <span className="pf-paper-id">Reference · {portraitId}</span>
                  <span className="pf-paper-copy">{document.empty}</span>
                  <span className="pf-paper-note">awaiting archive material</span>
                  <span className="pf-paper-foot">Archive copy · {document.category}</span>
                </span>
                {!active && (
                  <span className="pf-paper-edge" aria-hidden="true">
                    {String(index + 1).padStart(2, "0")} · {document.category}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <p className="pf-paper-caption" aria-live="polite">
          {String(activeIndex + 1).padStart(2, "0")} / {String(documents.length).padStart(2, "0")} · {activeDocument.category}
        </p>
      </div>

      <nav className="pf-document-index" aria-label="Choose a document">
        {documents.map((document, index) => (
          <button
            key={document.category}
            type="button"
            aria-label={`Open ${document.category} document`}
            aria-current={index === activeIndex ? "page" : undefined}
            onClick={selectDocument(index)}
          >
            {String(index + 1).padStart(2, "0")}
          </button>
        ))}
      </nav>
    </aside>
  );
}
