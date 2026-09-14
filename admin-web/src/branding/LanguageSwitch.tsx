import type { Language } from "../demo/language";
import "./language-switch.css";

/**
 * Flags are drawn inline rather than loaded as files: the tablet works offline,
 * and a missing image would leave the mechanic with an unlabelled button. Each
 * flag is decorative; the name of the language is what is announced. The name
 * is also set as aria-label because the narrow layout hides the visible text.
 */
function JapanFlag() {
  return (
    <svg viewBox="0 0 30 20" className="language-flag" aria-hidden="true">
      <rect width="30" height="20" fill="#ffffff" />
      <circle cx="15" cy="10" r="6" fill="#bc002d" />
      <rect
        width="30"
        height="20"
        fill="none"
        stroke="#00000022"
        strokeWidth="1"
      />
    </svg>
  );
}

function BrazilFlag() {
  return (
    <svg viewBox="0 0 30 20" className="language-flag" aria-hidden="true">
      <rect width="30" height="20" fill="#009b3a" />
      <path d="M15 2.6 27.4 10 15 17.4 2.6 10Z" fill="#fedf00" />
      <circle cx="15" cy="10" r="4.4" fill="#002776" />
      <path
        d="M10.9 8.2A9.4 9.4 0 0 1 19 9.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.2"
      />
      <rect
        width="30"
        height="20"
        fill="none"
        stroke="#00000022"
        strokeWidth="1"
      />
    </svg>
  );
}

/** Written in its own language, so it reads correctly to whoever is looking. */
const nativeName: Record<Language, string> = {
  ja: "日本語",
  "pt-BR": "Português",
};

const switchLabel: Record<Language, string> = {
  ja: "表示言語",
  "pt-BR": "Idioma",
};

export default function LanguageSwitch({
  language,
  onChange,
  className = "",
}: {
  language: Language;
  onChange: (next: Language) => void;
  className?: string;
}) {
  return (
    <div
      className={`language-switch ${className}`.trim()}
      role="group"
      aria-label={switchLabel[language]}
    >
      {(["ja", "pt-BR"] as Language[]).map((option) => (
        <button
          type="button"
          key={option}
          lang={option}
          aria-label={nativeName[option]}
          aria-pressed={language === option}
          onClick={() => onChange(option)}
        >
          {option === "ja" ? <JapanFlag /> : <BrazilFlag />}
          <span>{nativeName[option]}</span>
        </button>
      ))}
    </div>
  );
}
