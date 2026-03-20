import { Link } from "react-router-dom";
import AppFooter from "@/components/AppFooter";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { APP_DISPLAY_NAME, SUPPORT_EMAIL } from "@/config/appInfo";

const sections = [
  {
    title: "What This Policy Covers",
    body: [
      `This privacy policy describes how ${APP_DISPLAY_NAME} collects, stores, and uses information inside the internal workspace application.`,
      "This dashboard is used to manage catering inquiries, clients, events, email templates, contract templates, and related workflow data.",
    ],
  },
  {
    title: "Information We Collect",
    body: [
      "Inquiry records may include names, company names, event details, contact email addresses, phone numbers, guest counts, notes, and matching metadata used to associate an inquiry with a client.",
      "Client and event records may include contact details, event scheduling information, inquiry links, and internal workflow fields used to manage follow-up and operations.",
      "Custom email templates and uploaded contract template files are stored when workspace users create or upload them.",
      "The app also stores local preference data in the browser, such as theme choice, dashboard settings, inbox display settings, and whether certain welcome or unread indicators have been seen.",
    ],
  },
  {
    title: "How We Use Information",
    body: [
      "We use inquiry, client, and event data to review inbound catering requests, match inquiries to returning clients, create events, generate email drafts, generate or override contract templates, and support internal catering operations.",
      "We use template data to let workspace users create, edit, preview, and reuse response templates.",
      "We use local browser settings to remember workspace preferences such as theme, dashboard defaults, inbox page size, notification preferences, and related UI state.",
    ],
  },
  {
    title: "Storage And Services",
    body: [
      "Workspace data is stored using Firebase services, including Firestore for application records and Firebase Storage for uploaded contract template files.",
      "Workspace authentication is handled by Firebase Authentication for authorized internal users.",
      "The app uses Firebase Analytics in the browser.",
      "Certain browser settings, such as theme preference and related workspace UI preferences, may be stored in local storage or session storage so they persist appropriately across reloads or browser sessions.",
    ],
  },
  {
    title: "Realtime Updates And Notifications",
    body: [
      "The dashboard subscribes to live inquiry updates so new or changed inquiries can appear without a manual refresh.",
      "If enabled by the user, the app may show in-app toasts and browser desktop notifications for new inquiries. Notification permission is managed by the browser and can be changed in browser settings at any time.",
    ],
  },
  {
    title: "Sharing And Access",
    body: [
      "This dashboard is intended for internal workspace use. Information is used to operate the catering workflow and is available to authorized workspace users with access to the app and underlying data services.",
      "We do not describe any sale of personal information in this application. Data may be processed by service providers used to run the app, including Firebase services.",
    ],
  },
  {
    title: "Data Retention",
    body: [
      "Inquiry, client, event, template, and uploaded document data may be retained for operational, recordkeeping, and workflow history purposes unless removed by an authorized workspace user or administrator.",
      "Browser-stored preference and session data remains until cleared by the app, the browser session ends, or the user clears browser storage.",
    ],
  },
  {
    title: "Security",
    body: [
      "The app relies on Firebase project configuration, application routing protections, and configured data access rules to restrict access to workspace records.",
      "No system is guaranteed to be perfectly secure, and users should avoid sharing workspace credentials or using unsecured devices to access the dashboard.",
    ],
  },
  {
    title: "Contact",
    body: [
      `For privacy questions or requests about this dashboard, contact ${SUPPORT_EMAIL}.`,
    ],
  },
] as const;

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-sidebar text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <Badge variant="secondary">Privacy</Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Privacy Policy
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Effective March 13, 2026. This page describes how {APP_DISPLAY_NAME} handles workspace data and browser-side preferences.
              </p>
              <div className="flex flex-wrap gap-3 text-sm">
                <Link
                  to="/login"
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Back to login
                </Link>
                <Link
                  to="/dashboard"
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  Go to dashboard
                </Link>
              </div>
            </div>
          </div>

          <Separator />

          <article className="space-y-8">
            {sections.map((section) => (
              <section key={section.title} className="space-y-3">
                <h2 className="text-lg font-semibold">{section.title}</h2>
                <div className="space-y-3 text-sm leading-6 text-muted-foreground sm:text-base">
                  {section.body.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </article>
        </div>

        <div className="pt-10">
          <AppFooter />
        </div>
      </main>
    </div>
  );
}
