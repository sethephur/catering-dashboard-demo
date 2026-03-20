import { useEffect, useState } from "react";
import type { InquiryStatus } from "@/shared-types";

export type SiteSettings = {
  defaultInquiryStatus: "" | InquiryStatus;
  showDashboardSummary: boolean;
  showInquiryGraph: boolean;
  defaultInquiryGraphRange: "week" | "month" | "year";
  defaultTheme: "system" | "light" | "dark";
  inboxPageSize: 10 | 20 | 30 | 40;
  showInquiryMatchBadges: boolean;
  enableNewInquiryToasts: boolean;
  enableDesktopNotifications: boolean;
};

const SITE_SETTINGS_KEY = "site-settings";
const SITE_SETTINGS_EVENT = "site-settings-change";

const DEFAULT_SETTINGS: SiteSettings = {
  defaultInquiryStatus: "",
  showDashboardSummary: true,
  showInquiryGraph: true,
  defaultInquiryGraphRange: "month",
  defaultTheme: "system",
  inboxPageSize: 10,
  showInquiryMatchBadges: true,
  enableNewInquiryToasts: true,
  enableDesktopNotifications: true,
};

const serializeSiteSettings = (settings: SiteSettings) =>
  JSON.stringify(settings);

const parseSiteSettings = (raw: string | null): SiteSettings => {
  const legacyTheme =
    typeof window !== "undefined" ? window.localStorage.getItem("theme") : null;
  const fallbackTheme =
    legacyTheme === "dark" || legacyTheme === "light" ? legacyTheme : "system";

  if (!raw) return { ...DEFAULT_SETTINGS, defaultTheme: fallbackTheme };

  try {
    const parsed = JSON.parse(raw) as Partial<SiteSettings>;
    return {
      defaultInquiryStatus:
        parsed.defaultInquiryStatus === "completed" ||
        parsed.defaultInquiryStatus === "unprocessed"
          ? parsed.defaultInquiryStatus
          : "",
      showDashboardSummary:
        typeof parsed.showDashboardSummary === "boolean"
          ? parsed.showDashboardSummary
          : true,
      showInquiryGraph:
        typeof parsed.showInquiryGraph === "boolean"
          ? parsed.showInquiryGraph
          : true,
      defaultInquiryGraphRange:
        parsed.defaultInquiryGraphRange === "week" ||
        parsed.defaultInquiryGraphRange === "month" ||
        parsed.defaultInquiryGraphRange === "year"
          ? parsed.defaultInquiryGraphRange
          : "month",
      defaultTheme:
        parsed.defaultTheme === "light" ||
        parsed.defaultTheme === "dark" ||
        parsed.defaultTheme === "system"
          ? parsed.defaultTheme
          : fallbackTheme,
      inboxPageSize:
        parsed.inboxPageSize === 10 ||
        parsed.inboxPageSize === 20 ||
        parsed.inboxPageSize === 30 ||
        parsed.inboxPageSize === 40
          ? parsed.inboxPageSize
          : 10,
      showInquiryMatchBadges:
        typeof parsed.showInquiryMatchBadges === "boolean"
          ? parsed.showInquiryMatchBadges
          : true,
      enableNewInquiryToasts:
        typeof parsed.enableNewInquiryToasts === "boolean"
          ? parsed.enableNewInquiryToasts
          : true,
      enableDesktopNotifications:
        typeof parsed.enableDesktopNotifications === "boolean"
          ? parsed.enableDesktopNotifications
          : true,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, defaultTheme: fallbackTheme };
  }
};

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    return parseSiteSettings(window.localStorage.getItem(SITE_SETTINGS_KEY));
  });

  useEffect(() => {
    const serialized = serializeSiteSettings(settings);
    const current = window.localStorage.getItem(SITE_SETTINGS_KEY);

    if (current === serialized) return;

    window.localStorage.setItem(SITE_SETTINGS_KEY, serialized);
    window.dispatchEvent(new CustomEvent(SITE_SETTINGS_EVENT, { detail: settings }));
  }, [settings]);

  useEffect(() => {
    const syncFromStorage = () => {
      const nextSettings = parseSiteSettings(
        window.localStorage.getItem(SITE_SETTINGS_KEY),
      );
      const nextSerialized = serializeSiteSettings(nextSettings);

      setSettings((prev) =>
        serializeSiteSettings(prev) === nextSerialized ? prev : nextSettings,
      );
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key && event.key !== SITE_SETTINGS_KEY) return;
      syncFromStorage();
    };

    const handleCustomSync = () => {
      syncFromStorage();
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(SITE_SETTINGS_EVENT, handleCustomSync);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(SITE_SETTINGS_EVENT, handleCustomSync);
    };
  }, []);

  return {
    settings,
    updateSettings: (patch: Partial<SiteSettings>) =>
      setSettings((prev) => ({ ...prev, ...patch })),
    resetSettings: () => setSettings(DEFAULT_SETTINGS),
  };
}
