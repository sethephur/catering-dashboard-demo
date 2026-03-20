import { Link } from "react-router-dom";
import {
  APP_DISPLAY_NAME,
  PUBLIC_WEBSITE_URL,
} from "@/config/appInfo";

const footerLinks = [
  {
    label: "Website",
    href: PUBLIC_WEBSITE_URL,
  },
  {
    label: "Help",
    href: "/help",
  },
  {
    label: "Privacy",
    href: "/privacy",
  },
  {
    label: "Demo notes",
    href: "https://example.com/demo-notes",
  },
] as const;

export default function AppFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 pt-4 text-xs text-muted-foreground">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p>Copyright © {year} {APP_DISPLAY_NAME}.</p>
        <nav
          aria-label="Footer"
          className="flex flex-wrap items-center gap-x-4 gap-y-2"
        >
          {footerLinks.map((link) => (
            link.href.startsWith("/") ? (
              <Link
                key={link.label}
                to={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ) : (
              <a
                key={link.label}
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={
                  link.href.startsWith("http")
                    ? "noreferrer noopener"
                    : undefined
                }
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            )
          ))}
        </nav>
      </div>
    </footer>
  );
}
