import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function CalendarPage() {
  const [selected, setSelected] = useState<Date | undefined>(new Date());

  return (
    <section className="space-y-6">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 shadow-sm dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
        <Badge variant="secondary" className="mb-3">
          Calendar
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight">Calendar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          First-pass calendar view for planning event cadence and future scheduling
          workflows.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[auto_1fr]">
        <Card className="w-fit">
          <CardContent className="p-3">
            <Calendar
              mode="single"
              selected={selected}
              onSelect={setSelected}
              captionLayout="dropdown"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Planning Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              This page is in place so the new sidebar has a stable calendar
              destination. Next steps can layer in event markers, upcoming jobs,
              and inquiry follow-up deadlines.
            </p>
            <p>
              Selected date:{" "}
              <span className="font-medium text-foreground">
                {selected
                  ? selected.toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "No date selected"}
              </span>
            </p>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
