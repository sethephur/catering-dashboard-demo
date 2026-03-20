import { useMemo, useRef, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
} from "@tanstack/react-table";
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LoaderCircle,
} from "lucide-react";
import { IconDotsVertical } from "@tabler/icons-react";
import type { Inquiry, InquiryStatus } from "@/shared-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type InquiryInboxRow = {
  inquiry: Inquiry;
  displayNumber: number;
  docKey: string;
  isUnread: boolean;
  receivedAt: string;
  eventDate: string;
  eventTime: string;
  inquiryLabel: string;
  eventLabel: string;
  contactLabel: string;
  guestCount: string;
  status: InquiryStatus;
  matchStatus: Inquiry["matchStatus"] | null;
};

type InquiryInboxTableProps = {
  rows: InquiryInboxRow[];
  loading: boolean;
  showMatchBadges?: boolean;
  manualPagination?: boolean;
  pageIndex?: number;
  pageSize?: number;
  pageCount?: number;
  totalRows?: number;
  canNextPage?: boolean;
  canPreviousPage?: boolean;
  onPageIndexChange?: (nextPageIndex: number) => void;
  onPageSizeChange?: (nextPageSize: number) => void;
  savingStatus: Record<string, boolean>;
  onOpenInquiry: (inquiry: Inquiry, displayNumber: number) => void;
  onRequestDelete: (inquiry: Inquiry, displayNumber: number) => void;
  onStatusChange: (
    inquiryId: string,
    newStatus: InquiryStatus,
    inquiryNumber: number,
  ) => void | Promise<void>;
};

const statusBadgeStyles: Record<InquiryStatus, string> = {
  unprocessed: "text-muted-foreground",
  completed: "text-foreground",
};

const matchBadgeConfig: Record<
  NonNullable<InquiryInboxRow["matchStatus"]>,
  { label: string; className: string }
> = {
  linked: {
    label: "Linked",
    className: "border-emerald-500/30 text-emerald-700 dark:text-emerald-300",
  },
  manual_override: {
    label: "Manual",
    className: "border-sky-500/30 text-sky-700 dark:text-sky-300",
  },
  ambiguous_match: {
    label: "Needs review",
    className: "border-amber-500/30 text-amber-700 dark:text-amber-300",
  },
  no_match: {
    label: "No match",
    className: "border-rose-500/30 text-rose-700 dark:text-rose-300",
  },
};

const columnCellClassNames: Partial<Record<string, string>> = {
  inquiryLabel: "w-[220px]",
  receivedAt: "w-[156px]",
  eventLabel: "w-[196px]",
  eventDate: "w-[132px]",
  contactLabel: "w-[198px]",
  guestCount: "w-[72px]",
  status: "w-[124px]",
  actions: "w-[44px] pr-2 text-right",
};

export default function InquiryInboxTable({
  rows,
  loading,
  showMatchBadges = true,
  manualPagination = false,
  pageIndex: controlledPageIndex,
  pageSize: controlledPageSize,
  pageCount,
  totalRows,
  canNextPage,
  canPreviousPage,
  onPageIndexChange,
  onPageSizeChange,
  savingStatus,
  onOpenInquiry,
  onRequestDelete,
  onStatusChange,
}: InquiryInboxTableProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  });
  const suppressRowClickRef = useRef(false);
  const paginationState = manualPagination
    ? {
        pageIndex: controlledPageIndex ?? 0,
        pageSize: controlledPageSize ?? pagination.pageSize,
      }
    : pagination;

  const suppressNextRowClick = () => {
    suppressRowClickRef.current = true;
    window.setTimeout(() => {
      suppressRowClickRef.current = false;
    }, 0);
  };

  const columns = useMemo<ColumnDef<InquiryInboxRow>[]>(
    () => [
      {
        accessorKey: "inquiryLabel",
        header: () => <div className="w-[220px]">Inquiry</div>,
        cell: ({ row }) => {
          const item = row.original;
          const matchBadge =
            item.matchStatus != null ? matchBadgeConfig[item.matchStatus] : null;

          return (
            <div className="relative w-[220px] max-w-[220px] pt-4 pl-4">
              {item.isUnread && (
                <span
                  className="absolute top-[1.3rem] left-0 size-2 rounded-full bg-sky-500"
                  aria-label="Unread inquiry"
                />
              )}
              {item.docKey && (
                <div className="absolute top-0 left-4 truncate text-[11px] text-muted-foreground/30">
                  ID: {item.docKey}
                </div>
              )}
              <div className="space-y-0 leading-tight">
                <Button
                  variant="link"
                  className="h-auto max-w-full justify-start px-0 py-0 text-left text-foreground"
                  onClick={() => onOpenInquiry(item.inquiry, item.displayNumber)}
                >
                  <span className="truncate">Inquiry #{item.displayNumber}</span>
                </Button>
              </div>
              <div className="mt-1.5 flex items-center gap-2 overflow-hidden">
                <div className="truncate text-sm text-muted-foreground">
                  {item.inquiryLabel}
                </div>
                {showMatchBadges && matchBadge && (
                  <Badge
                    variant="outline"
                    className={`shrink-0 px-1.5 text-[11px] ${matchBadge.className}`}
                  >
                    {matchBadge.label}
                  </Badge>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "receivedAt",
        header: () => <div className="w-[156px]">Received</div>,
        cell: ({ row }) => (
          <div className="w-[156px] whitespace-normal break-words text-sm leading-5 text-muted-foreground">
            {row.original.receivedAt}
          </div>
        ),
      },
      {
        accessorKey: "eventLabel",
        header: () => <div className="w-[196px]">Event</div>,
        cell: ({ row }) => (
          <div className="w-[196px] min-w-0 overflow-hidden">
            <div className="truncate text-sm font-medium text-foreground">
              {row.original.eventLabel}
            </div>
            <div className="hidden truncate text-sm text-muted-foreground md:block">
              {row.original.inquiry.operation || "Operation TBD"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "eventDate",
        header: () => <div className="w-[132px]">Date</div>,
        cell: ({ row }) => (
          <div className="w-[132px] min-w-0 overflow-hidden text-sm text-foreground">
            <div className="truncate">{row.original.eventDate}</div>
            <div className="truncate text-muted-foreground">{row.original.eventTime}</div>
          </div>
        ),
      },
      {
        accessorKey: "contactLabel",
        header: () => <div className="w-[198px]">Contact</div>,
        cell: ({ row }) => (
          <div className="w-[198px] min-w-0">
            <div className="truncate text-sm text-foreground">{row.original.contactLabel}</div>
            <div className="truncate text-sm text-muted-foreground">
              {row.original.inquiry.phoneNumber || "No phone"}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "guestCount",
        header: () => <div className="w-[72px] text-right">Guests</div>,
        cell: ({ row }) => (
          <div className="w-[72px] text-right text-sm text-foreground">
            {row.original.guestCount}
          </div>
        ),
      },
      {
        accessorKey: "status",
        header: () => <div className="w-[124px]">Status</div>,
        cell: ({ row }) => {
          const item = row.original;

          return (
            <Badge
              variant="outline"
              className={`w-fit gap-1.5 px-1.5 ${statusBadgeStyles[item.status]}`}
            >
              {item.status === "completed" ? (
                <BadgeCheck className="size-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <LoaderCircle className="size-3.5" />
              )}
              {item.status === "completed" ? "Completed" : "Unprocessed"}
            </Badge>
          );
        },
      },
      {
        id: "actions",
        header: () => <div className="w-full text-right">Actions</div>,
        cell: ({ row }) => {
          const item = row.original;
          const nextStatus =
            item.status === "completed" ? "unprocessed" : "completed";
          const nextStatusLabel =
            nextStatus === "completed" ? "Mark completed" : "Mark unprocessed";

          return (
            <div className="flex w-full justify-end" data-inquiry-action-menu="true">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-8 cursor-pointer text-muted-foreground"
                    onClick={(event) => {
                      event.stopPropagation();
                      suppressNextRowClick();
                    }}
                  >
                    <IconDotsVertical className="size-4" />
                    <span className="sr-only">Open actions menu</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-44"
                  onClick={(event) => {
                    event.stopPropagation();
                    suppressNextRowClick();
                  }}
                >
                  <DropdownMenuItem
                    onClick={(event) => {
                      event.stopPropagation();
                      suppressNextRowClick();
                      onOpenInquiry(item.inquiry, item.displayNumber);
                    }}
                  >
                    Open inquiry
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!item.docKey || !!savingStatus[item.docKey]}
                    onClick={(event) => {
                      event.stopPropagation();
                      suppressNextRowClick();
                      void onStatusChange(
                        item.docKey,
                        nextStatus,
                        item.displayNumber,
                      );
                    }}
                  >
                    {nextStatusLabel}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={!item.docKey}
                    onClick={(event) => {
                      event.stopPropagation();
                      suppressNextRowClick();
                      onRequestDelete(item.inquiry, item.displayNumber);
                    }}
                  >
                    Delete inquiry
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [onOpenInquiry, onRequestDelete, onStatusChange, savingStatus, showMatchBadges],
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { pagination: paginationState },
    onPaginationChange: manualPagination
      ? (updater) => {
          const next =
            typeof updater === "function" ? updater(paginationState) : updater;
          if (next.pageIndex !== paginationState.pageIndex) {
            onPageIndexChange?.(next.pageIndex);
          }
          if (next.pageSize !== paginationState.pageSize) {
            onPageSizeChange?.(next.pageSize);
          }
        }
      : setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination,
    pageCount,
  });

  const loadingRowCount = paginationState.pageSize;
  const totalVisibleRows = totalRows ?? rows.length;
  const resolvedCanPreviousPage = manualPagination
    ? (canPreviousPage ?? paginationState.pageIndex > 0)
    : table.getCanPreviousPage();
  const resolvedCanNextPage = manualPagination
    ? (canNextPage ?? false)
    : table.getCanNextPage();
  const resolvedPageCount = manualPagination
    ? Math.max(pageCount ?? 1, 1)
    : Math.max(table.getPageCount(), 1);

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[0.875rem] border border-border/70">
        <Table className="min-w-[1260px] table-fixed lg:min-w-[1180px] xl:min-w-full [&_th]:overflow-hidden [&_td]:overflow-hidden">
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={`overflow-hidden ${columnCellClassNames[header.id] ?? ""}`}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: Math.min(loadingRowCount, 5) }, (_, index) => (
                <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                  <TableCell>
                    <div className="space-y-2 py-1">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-44" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2 py-1">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2 py-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-2 py-1">
                      <Skeleton className="h-4 w-36" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end py-1">
                      <Skeleton className="h-4 w-10" />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-8 w-[140px] rounded-md" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Skeleton className="size-8 rounded-md" />
                      <Skeleton className="size-8 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={(event) => {
                    if (suppressRowClickRef.current) {
                      suppressRowClickRef.current = false;
                      return;
                    }
                    const target = event.target as HTMLElement | null;
                    if (
                      target?.closest("[data-inquiry-action-menu='true']") ||
                      target?.closest("button, a, [role='button']")
                    ) {
                      return;
                    }

                    onOpenInquiry(
                      row.original.inquiry,
                      row.original.displayNumber,
                    );
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={`overflow-hidden ${columnCellClassNames[cell.column.id] ?? ""}`}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  No matching inquiries.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4 px-1">
        <div className="text-sm text-muted-foreground">
          {totalVisibleRows} total inquiry{totalVisibleRows === 1 ? "" : "ies"}
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden items-center gap-2 sm:flex">
            <Label htmlFor="inquiry-rows-per-page" className="text-sm">
              Rows per page
            </Label>
            <Select
              value={`${paginationState.pageSize}`}
              onValueChange={(value) => {
                const nextPageSize = Number(value);
                if (manualPagination) {
                  onPageSizeChange?.(nextPageSize);
                  return;
                }
                table.setPageSize(nextPageSize);
              }}
            >
              <SelectTrigger
                id="inquiry-rows-per-page"
                size="sm"
                className="w-20"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                {[10, 20, 30, 40].map((pageSize) => (
                  <SelectItem key={pageSize} value={`${pageSize}`}>
                    {pageSize}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="text-sm font-medium">
            Page {paginationState.pageIndex + 1} of {resolvedPageCount}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 sm:flex"
              onClick={() => {
                if (manualPagination) {
                  onPageIndexChange?.(0);
                  return;
                }
                table.setPageIndex(0);
              }}
              disabled={!resolvedCanPreviousPage}
            >
              <ChevronsLeft className="size-4" />
              <span className="sr-only">First page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => {
                if (manualPagination) {
                  onPageIndexChange?.(Math.max(paginationState.pageIndex - 1, 0));
                  return;
                }
                table.previousPage();
              }}
              disabled={!resolvedCanPreviousPage}
            >
              <ChevronLeft className="size-4" />
              <span className="sr-only">Previous page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => {
                if (manualPagination) {
                  onPageIndexChange?.(paginationState.pageIndex + 1);
                  return;
                }
                table.nextPage();
              }}
              disabled={!resolvedCanNextPage}
            >
              <ChevronRight className="size-4" />
              <span className="sr-only">Next page</span>
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="hidden size-8 sm:flex"
              onClick={() => {
                if (manualPagination) {
                  onPageIndexChange?.(Math.max(resolvedPageCount - 1, 0));
                  return;
                }
                table.setPageIndex(table.getPageCount() - 1);
              }}
              disabled={!resolvedCanNextPage}
            >
              <ChevronsRight className="size-4" />
              <span className="sr-only">Last page</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
