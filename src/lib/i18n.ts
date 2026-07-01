import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "@/locales/en/common.json";

export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", native: "English", rtl: false },
  { code: "ta", name: "Tamil", native: "தமிழ்", rtl: false },
  { code: "hi", name: "Hindi", native: "हिन्दी", rtl: false },
  { code: "te", name: "Telugu", native: "తెలుగు", rtl: false },
  { code: "ml", name: "Malayalam", native: "മലയാളം", rtl: false },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ", rtl: false },
  { code: "bn", name: "Bengali", native: "বাংলা", rtl: false },
  { code: "mr", name: "Marathi", native: "मराठी", rtl: false },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી", rtl: false },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ", rtl: false },
  { code: "ur", name: "Urdu", native: "اردو", rtl: true },
  { code: "ar", name: "Arabic", native: "العربية", rtl: true },
  { code: "fr", name: "French", native: "Français", rtl: false },
  { code: "de", name: "German", native: "Deutsch", rtl: false },
  { code: "es", name: "Spanish", native: "Español", rtl: false },
  { code: "pt", name: "Portuguese", native: "Português", rtl: false },
  { code: "it", name: "Italian", native: "Italiano", rtl: false },
  { code: "ru", name: "Russian", native: "Русский", rtl: false },
  { code: "ja", name: "Japanese", native: "日本語", rtl: false },
  { code: "ko", name: "Korean", native: "한국어", rtl: false },
  { code: "zh", name: "Chinese (Simplified)", native: "中文", rtl: false },
] as const;

export type LangCode = (typeof SUPPORTED_LANGUAGES)[number]["code"];

// Only English is authored; other locales fall back to English keys until
// translations are filled in. This keeps the switcher instant + safe.
const resources: Record<string, { common: typeof en }> = {
  en: { common: en },
};
for (const l of SUPPORTED_LANGUAGES) {
  if (l.code !== "en") resources[l.code] = { common: en };
}

if (!i18n.isInitialized) {
  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: "en",
      defaultNS: "common",
      ns: ["common"],
      interpolation: { escapeValue: false },
      detection: {
        order: ["localStorage", "navigator"],
        lookupLocalStorage: "feyncloud:lang",
        caches: ["localStorage"],
      },
    });
}

function applyDir(code: string) {
  if (typeof document === "undefined") return;
  const l = SUPPORTED_LANGUAGES.find((x) => x.code === code);
  document.documentElement.lang = code;
  document.documentElement.dir = l?.rtl ? "rtl" : "ltr";
}

if (typeof window !== "undefined") {
  applyDir(i18n.language || "en");
  i18n.on("languageChanged", applyDir);
}

export function setLanguage(code: LangCode) {
  i18n.changeLanguage(code);
}

export default i18n;
