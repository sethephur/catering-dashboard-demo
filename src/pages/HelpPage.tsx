import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import AppFooter from "@/components/AppFooter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { createHelpTicket } from "@/data/helpTickets";
import { database } from "@/utils/firebaseConfig";
import { APP_DISPLAY_NAME, SUPPORT_EMAIL } from "@/config/appInfo";

const helpCategories = [
  "Bug report",
  "Data issue",
  "Feature request",
  "Access issue",
  "Workflow question",
  "Other",
] as const;

export default function HelpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<(typeof helpCategories)[number]>(
    "Bug report",
  );
  const [locationHint, setLocationHint] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!message.trim()) {
      toast.error("Please add a message before submitting.");
      return;
    }

    setSubmitting(true);

    try {
      await createHelpTicket({
        db: database,
        name,
        email,
        category,
        locationHint,
        message,
      });

      toast.success("Help ticket submitted.");
      setName("");
      setEmail("");
      setCategory("Bug report");
      setLocationHint("");
      setMessage("");
    } catch (error) {
      console.error("Failed to submit help ticket:", error);
      toast.error(
        `Could not submit the help ticket. You can also email ${SUPPORT_EMAIL} directly.`,
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-sidebar text-foreground">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex-1 space-y-8">
          <div className="space-y-4">
            <Badge variant="secondary">Help</Badge>
            <div className="space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Submit A Help Ticket
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                Use this form to report bugs, data issues, workflow problems, or
                feature requests directly from the dashboard.
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

          <Card className="border-border/70 bg-card/95 shadow-sm">
            <CardHeader>
              <CardTitle>New help ticket</CardTitle>
              <CardDescription>
                Share enough detail so the issue can be reproduced and handled
                quickly.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-6" onSubmit={handleSubmit}>
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="help-name">Name</Label>
                    <Input
                      id="help-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="help-email">Email</Label>
                    <Input
                      id="help-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="help-category">Category</Label>
                    <Select value={category} onValueChange={(value) => setCategory(value as (typeof helpCategories)[number])}>
                      <SelectTrigger id="help-category">
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {helpCategories.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="help-location">Affected page or workflow</Label>
                    <Input
                      id="help-location"
                      value={locationHint}
                      onChange={(e) => setLocationHint(e.target.value)}
                      placeholder="Example: Inquiry modal on mobile"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="help-message">Message</Label>
                  <Textarea
                    id="help-message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Describe what happened, what you expected, and any steps to reproduce it."
                    className="min-h-40"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit ticket"}
                  </Button>
                  <a
                    href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`${APP_DISPLAY_NAME} Help`)}`}
                    className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    Email support instead
                  </a>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <div className="pt-10">
          <AppFooter />
        </div>
      </main>
    </div>
  );
}
