/**
 * One language choice for the whole demonstration. The workshop in Japan is the
 * default audience, so the application opens in Japanese; a Brazilian mechanic
 * switches to Portuguese and the choice follows them across every screen and
 * survives a reload.
 *
 * Each interface shows one language only. There is no bilingual screen, and the
 * printed form is always Japanese regardless of what is chosen here.
 */
export type Language = "ja" | "pt-BR";

export const LANGUAGES: readonly Language[] = ["ja", "pt-BR"];
export const DEFAULT_LANGUAGE: Language = "ja";
export const LANGUAGE_STORAGE_KEY = "susumu.tenken.language.v1";

type Reader = Pick<Storage, "getItem">;
type Writer = Pick<Storage, "setItem">;

function isLanguage(value: unknown): value is Language {
  return value === "ja" || value === "pt-BR";
}

/** Never throws: a blocked or empty storage simply opens in Japanese. */
export function loadLanguage(storage: Reader): Language {
  try {
    const stored = storage.getItem(LANGUAGE_STORAGE_KEY);
    return isLanguage(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

/** Never throws: failing to remember the choice must not interrupt the work. */
export function saveLanguage(storage: Writer, language: Language): void {
  try {
    storage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch {
    // The screen already switched; only the memory of it is lost.
  }
}
