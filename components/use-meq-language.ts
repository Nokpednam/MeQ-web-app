"use client";

import { useEffect, useState } from "react";
import type { DashboardLanguage } from "@/lib/dashboard-translations";

export function useMeqLanguage() {
  const [language, setLanguage] = useState<DashboardLanguage>("th");

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem("meq-language");
    if (savedLanguage !== "th" && savedLanguage !== "en") return;
    const frame = window.requestAnimationFrame(() => {
      setLanguage(savedLanguage);
      document.documentElement.lang = savedLanguage;
    });
    const handleLanguageChange = (event: Event) => {
      const nextLanguage = (event as CustomEvent<DashboardLanguage>).detail;
      if (nextLanguage === "th" || nextLanguage === "en") setLanguage(nextLanguage);
    };
    window.addEventListener("meq-language-change", handleLanguageChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("meq-language-change", handleLanguageChange);
    };
  }, []);

  function selectLanguage(nextLanguage: DashboardLanguage) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("meq-language", nextLanguage);
    document.documentElement.lang = nextLanguage;
    window.dispatchEvent(new CustomEvent("meq-language-change", { detail: nextLanguage }));
  }

  return { language, selectLanguage };
}
