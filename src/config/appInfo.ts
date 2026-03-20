export const APP_DISPLAY_NAME = "Catering Dashboard Demo";
export const APP_WORKSPACE_LABEL = "Demo Workspace";
export const SUPPORT_EMAIL = "support@example.com";
export const PUBLIC_WEBSITE_URL = "https://example.com";
export const EMAIL_SUBJECT_PREFIX = "Catering Dashboard Inquiry";
export const REPORT_EXPORT_TITLE = "Catering Dashboard Reports";

const rawDemoMode = String(import.meta.env.VITE_DEMO_MODE ?? "").trim().toLowerCase();

export const DEMO_MODE_ENABLED = rawDemoMode !== "false";
