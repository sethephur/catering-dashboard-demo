import * as React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import type { TEvent } from "@/shared-types";

export type EventRowProps = {
  ev: TEvent & { clientName?: string; clientId?: string };
  setEditing: React.Dispatch<React.SetStateAction<TEvent>>;
  setEditOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onEdit?: (ev: TEvent) => void;
  onDelete?: (ev: TEvent) => void;
  onClick?: (ev: TEvent) => void;
};

const fmtTime = (t?: string | null) => (t ? t : "");

export default function EventRow({
  ev,
  setEditing,
  setEditOpen,
  onEdit,
  onDelete,
}: EventRowProps) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <TableRow
          className="cursor-pointer"
          onClick={() => {
            setEditing(ev);
            setEditOpen(true);
          }}
        >
          <TableCell className="whitespace-nowrap">
            {ev.eventDate || "—"}
          </TableCell>
          <TableCell className="whitespace-nowrap">
            {fmtTime(ev.startTime)}
            {ev.endTime ? ` – ${fmtTime(ev.endTime)}` : ""}
          </TableCell>
          <TableCell className="font-medium">
            {ev.eventName ?? "Untitled Event"}
          </TableCell>
          <TableCell>{ev.clientName || (ev as any).clientId || "—"}</TableCell>
          <TableCell>{ev.siteContact || "—"}</TableCell>
          <TableCell>{ev.plannedGuestCount || "—"}</TableCell>
          <TableCell>
            <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-300 dark:ring-neutral-700">
              {ev.eventStatus ?? "–"}
            </span>
          </TableCell>
        </TableRow>
      </ContextMenuTrigger>

      <ContextMenuContent>
        <ContextMenuItem onClick={() => onEdit?.(ev)}>Edit</ContextMenuItem>
        <ContextMenuItem
          className="text-red-600"
          onClick={() => onDelete?.(ev)}
        >
          Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
