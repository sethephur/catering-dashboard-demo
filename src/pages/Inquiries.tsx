import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react";
import { ListFilter } from "lucide-react";
import { toast } from "sonner";
import { DEMO_MODE_ENABLED, SUPPORT_EMAIL } from "@/config/appInfo";
import InquiryModal from "../components/InquiryModal";
import {
  getInquiryCount,
  getInquiryPage,
  subscribeInquiries,
  type InquiryCursor,
} from "../api/getInquiries";
import {
  convertTo12HourFormat,
  searchInquiries,
} from "../utils/helpers/helpers";
import { Inquiry, type InquiryStatus } from "../shared-types";
import {
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";
import { database } from "../utils/firebaseConfig";
import { useLocation } from "react-router-dom";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import InquiryVolumeChart from "@/components/dashboard/InquiryVolumeChart";
import InquiryInboxTable, {
  type InquiryInboxRow,
} from "@/components/dashboard/InquiryInboxTable";
import { Field } from "@/components/ui/field";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const VIEWED_INQUIRY_IDS_KEY = "viewed-inquiry-ids-v1";
const INQUIRY_UNREAD_INIT_KEY = "inquiry-unread-init-v1";

const getInquiryDocId = (inquiry: any): string => {
  const candidates = [inquiry?.docId, inquiry?.id];

  // Prefer first non-empty trimmed string
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) return c.trim();
  }
  // Then allow numeric ids
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return String(c);
  }
  return "";
};

const getStableInquiryNumber = (inquiry: any): number | null => {
  if (
    typeof inquiry?.inquiryNumber === "number" &&
    Number.isFinite(inquiry.inquiryNumber)
  ) {
    return inquiry.inquiryNumber;
  }

  if (typeof inquiry?.docId === "string") {
    const trimmed = inquiry.docId.trim();
    if (/^\d+$/.test(trimmed)) {
      return Number(trimmed);
    }
  }

  return null;
};

// Safely convert various date shapes (ISO string, Firestore Timestamp) to millis
const toMillis = (value: any): number => {
  try {
    if (!value) return 0;
    // Firestore Timestamp instance
    if (typeof value?.toDate === "function") return value.toDate().getTime();
    // Plain object with seconds (possible Timestamp-like)
    if (typeof value === "object" && typeof value.seconds === "number") {
      return value.seconds * 1000;
    }
    if (typeof value === "string") {
      const direct = Date.parse(value);
      if (!Number.isNaN(direct)) return direct;
      // Try a few light normalizations (handles "Aug 13, 2025 at 5:47 PM UTC-7")
      const normalized = value
        .replace(/\sat\s/i, " ")
        .replace(/\u202F/g, " ") // narrow no-break space
        .replace(/UTC/g, "GMT");
      const alt = Date.parse(normalized);
      if (!Number.isNaN(alt)) return alt;
    }
  } catch {}
  return 0;
};

// Choose best available created date field for sorting
const getCreatedAtMillis = (inquiry: any): number => {
  const candidate =
    inquiry?.createdAt ?? inquiry?.created_at ?? inquiry?.dateCreated;
  return toMillis(candidate);
};

// Format a date-like value (ISO string or Firestore Timestamp) to: Fri Aug 21, 2025, 6:27 PM
const formatDateTime = (value: any): string => {
  const ms = toMillis(value);
  if (!ms) return "Date not available";
  try {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ms));
  } catch {
    return "Date not available";
  }
};

const parseViewedInquiryIds = (): Record<string, true> => {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(VIEWED_INQUIRY_IDS_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return {};

    return parsed.reduce<Record<string, true>>((acc, item) => {
      if (typeof item === "string" && item.trim().length > 0) {
        acc[item.trim()] = true;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

const hasInitializedInquiryUnreadState = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(INQUIRY_UNREAD_INIT_KEY) === "true";
};

function Inquiries() {
  const location = useLocation();
  const { settings } = useSiteSettings();
  type InboxPageSize = 10 | 20 | 30 | 40;
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [pagedInquiries, setPagedInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<InboxPageSize>(
    settings.inboxPageSize,
  );
  const [totalInquiriesCount, setTotalInquiriesCount] = useState(0);
  const [selectedInquiry, setSelectedInquiry] = useState<Inquiry | null>(null);
  const [selectedInquiryNumber, setSelectedInquiryNumber] = useState<
    number | null
  >(null);
  const [searchValue, setSearchValue] = useState("");
  const [viewedInquiryIds, setViewedInquiryIds] = useState<
    Record<string, true>
  >(() => parseViewedInquiryIds());
  const [inquiryStatus, setInquiryStatus] = useState<
    Record<string, InquiryStatus>
  >({});
  const [statusFilter, setStatusFilter] = useState<"" | InquiryStatus>(
    settings.defaultInquiryStatus,
  );

  const [savingStatus, setSavingStatus] = useState<Record<string, boolean>>({});
  const [pendingDelete, setPendingDelete] = useState<{
    inquiry: Inquiry;
    inquiryNumber: number;
  } | null>(null);
  const [deletingInquiry, setDeletingInquiry] = useState(false);
  const [liveInquiriesReady, setLiveInquiriesReady] = useState(false);
  const pageCacheRef = useRef<Record<number, Inquiry[]>>({});
  const pageCursorRef = useRef<InquiryCursor[]>([null]);
  const pageRequestRef = useRef<Record<number, Promise<void>>>({});
  const viewedInquiryIdsRef = useRef<Record<string, true>>(viewedInquiryIds);
  const unreadStateInitializedRef = useRef(hasInitializedInquiryUnreadState());
  const knownInquiryIdsRef = useRef<Set<string> | null>(null);
  const desktopNotificationPromptedRef = useRef(false);
  const serverPaginationEligible =
    searchValue.trim().length === 0 && statusFilter === "";
  const shouldLoadAnalytics =
    settings.showDashboardSummary ||
    settings.showInquiryGraph ||
    !serverPaginationEligible;

  useEffect(() => {
    viewedInquiryIdsRef.current = viewedInquiryIds;

    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      VIEWED_INQUIRY_IDS_KEY,
      JSON.stringify(Object.keys(viewedInquiryIds)),
    );
  }, [viewedInquiryIds]);

  const markInquiryViewed = useCallback((inquiry: Inquiry) => {
    const inquiryId = getInquiryDocId(inquiry);
    if (!inquiryId) return;

    setViewedInquiryIds((prev) =>
      prev[inquiryId] ? prev : { ...prev, [inquiryId]: true },
    );
  }, []);

  const openInquiryPreview = useCallback(
    (inquiry: Inquiry, inquiryNumber: number) => {
      markInquiryViewed(inquiry);
      setSelectedInquiry(inquiry);
      setSelectedInquiryNumber(inquiryNumber);
    },
    [markInquiryViewed],
  );

  useEffect(() => {
    pageCacheRef.current = {};
    pageCursorRef.current = [null];
    pageRequestRef.current = {};
    setPageIndex(0);

    let active = true;

    const loadInitialPage = async () => {
      setLoading(true);
      try {
        const [count, firstPage] = await Promise.all([
          getInquiryCount(),
          getInquiryPage({ pageSize }),
        ]);

        if (!active) return;

        setTotalInquiriesCount(count);
        setPagedInquiries(firstPage.items);
        pageCacheRef.current[0] = firstPage.items;
        pageCursorRef.current[1] = firstPage.lastVisible;

        setInquiryStatus((prev) => {
          const next = { ...prev };
          firstPage.items.forEach((inquiry) => {
            const key = getInquiryDocId(inquiry);
            if (!key) return;
            next[key] =
              inquiry.status === "completed" ? "completed" : "unprocessed";
          });
          return next;
        });

        if (count > pageSize && firstPage.lastVisible) {
          void prefetchInboxPage(1, pageSize, count);
        }
      } catch (error) {
        toast(
          `Failed to load inquiries, please contact ${SUPPORT_EMAIL}`,
        );
        console.log(error);
      } finally {
        if (active) setLoading(false);
      }
    };

    loadInitialPage();

    return () => {
      active = false;
    };
  }, [pageSize]);

  useEffect(() => {
    if (pageSize === settings.inboxPageSize) return;
    setPageSize(settings.inboxPageSize);
  }, [pageSize, settings.inboxPageSize]);

  useEffect(() => {
    setAnalyticsLoading(true);

    const unsubscribe = subscribeInquiries(
      (data) => {
        const nextInquiryIds = new Set(
          data.map((inquiry) => getInquiryDocId(inquiry)).filter(Boolean),
        );
        const previousInquiryIds = knownInquiryIdsRef.current;

        if (
          previousInquiryIds == null &&
          !unreadStateInitializedRef.current &&
          Object.keys(viewedInquiryIdsRef.current).length === 0
        ) {
          const seededViewedIds = data.reduce<Record<string, true>>(
            (acc, inquiry) => {
              const inquiryId = getInquiryDocId(inquiry);
              if (inquiryId) acc[inquiryId] = true;
              return acc;
            },
            {},
          );

          viewedInquiryIdsRef.current = seededViewedIds;
          setViewedInquiryIds(seededViewedIds);
          unreadStateInitializedRef.current = true;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(INQUIRY_UNREAD_INIT_KEY, "true");
          }
        } else if (
          previousInquiryIds == null &&
          !unreadStateInitializedRef.current
        ) {
          unreadStateInitializedRef.current = true;
          if (typeof window !== "undefined") {
            window.localStorage.setItem(INQUIRY_UNREAD_INIT_KEY, "true");
          }
        }

        const newInquiries =
          previousInquiryIds == null
            ? []
            : data.filter((inquiry) => {
                const inquiryId = getInquiryDocId(inquiry);
                return (
                  inquiryId.length > 0 && !previousInquiryIds.has(inquiryId)
                );
              });

        setInquiries(data);
        setTotalInquiriesCount(data.length);
        setLiveInquiriesReady(true);
        knownInquiryIdsRef.current = nextInquiryIds;
        setInquiryStatus((prev) => {
          const next = { ...prev };
          data.forEach((inquiry) => {
            const key = getInquiryDocId(inquiry);
            if (!key) return;
            next[key] =
              inquiry.status === "completed" ? "completed" : "unprocessed";
          });
          return next;
        });
        setSelectedInquiry((prev) => {
          if (!prev) return prev;
          const selectedId = getInquiryDocId(prev);
          return (
            data.find((inquiry) => getInquiryDocId(inquiry) === selectedId) ??
            prev
          );
        });

        newInquiries.forEach((inquiry, index) => {
          const inquiryId = getInquiryDocId(inquiry);
          const fullName = [inquiry.firstName, inquiry.lastName]
            .filter(Boolean)
            .join(" ")
            .trim();
          const label =
            fullName ||
            inquiry.company ||
            inquiry.email ||
            `Inquiry ${inquiryId}`;
          const displayNumber =
            getStableInquiryNumber(inquiry) ?? Math.max(data.length - index, 1);

          if (settings.enableNewInquiryToasts) {
            toast.custom(
              (toastId) => (
                <button
                  type="button"
                  className="flex w-full min-w-[320px] cursor-pointer flex-col items-start gap-1 rounded-xl border border-border bg-background px-4 py-3 text-left shadow-lg"
                  onClick={() => {
                    openInquiryPreview(inquiry, displayNumber);
                    toast.dismiss(toastId);
                  }}
                >
                  <span className="text-sm font-semibold text-foreground">
                    New inquiry received
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {label} just submitted an inquiry.
                  </span>
                  <span className="text-xs font-medium text-primary">
                    Click to open
                  </span>
                </button>
              ),
              {
                duration: 6000,
              },
            );
          }

          const canNotify =
            typeof window !== "undefined" &&
            settings.enableDesktopNotifications &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            (document.visibilityState !== "visible" || !document.hasFocus());

          if (canNotify) {
            const notification = new Notification("New inquiry received", {
              body: `${label} just submitted an inquiry.`,
              tag: `inquiry-${inquiryId}`,
            });

            notification.onclick = () => {
              window.focus();
              openInquiryPreview(inquiry, displayNumber);
              notification.close();
            };
          }
        });
        setAnalyticsLoading(false);
      },
      (error) => {
        toast(
          `Failed to subscribe to live inquiries, please contact ${SUPPORT_EMAIL}`,
        );
        console.log(error);
        setAnalyticsLoading(false);
      },
    );

    return () => unsubscribe();
  }, [
    openInquiryPreview,
    settings.enableDesktopNotifications,
    settings.enableNewInquiryToasts,
  ]);

  useEffect(() => {
    if (!settings.enableDesktopNotifications) return;
    if (desktopNotificationPromptedRef.current) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    desktopNotificationPromptedRef.current = true;

    toast("Enable desktop notifications?", {
      description: "Get a browser notification when a new inquiry comes in.",
      action: {
        label: "Allow",
        onClick: async () => {
          try {
            const permission = await Notification.requestPermission();
            if (permission === "granted") {
              toast.success("Desktop notifications enabled.");
            } else if (permission === "denied") {
              toast.error("Desktop notifications were blocked by the browser.");
            }
          } catch (error) {
            console.error("Failed to request notification permission:", error);
            toast.error("Could not enable desktop notifications.");
          }
        },
      },
    });
  }, [settings.enableDesktopNotifications]);

  const prefetchInboxPage = async (
    nextPageIndex: number,
    nextPageSize: InboxPageSize = pageSize,
    knownTotalCount = totalInquiriesCount,
  ) => {
    await ensureInboxPageCached(nextPageIndex, nextPageSize, knownTotalCount);
  };

  const fetchAndCacheInboxPage = async (
    targetPageIndex: number,
    nextPageSize: InboxPageSize,
  ) => {
    if (pageRequestRef.current[targetPageIndex]) {
      await pageRequestRef.current[targetPageIndex];
      return;
    }

    const cursor = pageCursorRef.current[targetPageIndex];
    if (targetPageIndex > 0 && typeof cursor === "undefined") {
      return;
    }

    const request = (async () => {
      const page = await getInquiryPage({
        pageSize: nextPageSize,
        cursor: cursor ?? null,
      });

      pageCacheRef.current[targetPageIndex] = page.items;
      pageCursorRef.current[targetPageIndex + 1] = page.lastVisible;
      setInquiryStatus((prev) => {
        const next = { ...prev };
        page.items.forEach((inquiry) => {
          const key = getInquiryDocId(inquiry);
          if (!key) return;
          next[key] =
            inquiry.status === "completed" ? "completed" : "unprocessed";
        });
        return next;
      });
    })().finally(() => {
      delete pageRequestRef.current[targetPageIndex];
    });

    pageRequestRef.current[targetPageIndex] = request;
    await request;
  };

  const ensureInboxPageCached = async (
    targetPageIndex: number,
    nextPageSize: InboxPageSize = pageSize,
    knownTotalCount = totalInquiriesCount,
  ) => {
    if (
      knownTotalCount > 0 &&
      targetPageIndex * nextPageSize >= knownTotalCount
    ) {
      return false;
    }

    for (
      let currentIndex = 0;
      currentIndex <= targetPageIndex;
      currentIndex += 1
    ) {
      if (pageCacheRef.current[currentIndex]) continue;
      await fetchAndCacheInboxPage(currentIndex, nextPageSize);
      if (!pageCacheRef.current[currentIndex]) {
        return false;
      }
    }

    return true;
  };

  const loadInboxPage = async (
    nextPageIndex: number,
    nextPageSize: InboxPageSize = pageSize,
  ) => {
    if (liveInquiriesReady && serverPaginationEnabled) {
      setPageIndex(nextPageIndex);
      return;
    }

    if (pageCacheRef.current[nextPageIndex]) {
      setPagedInquiries(pageCacheRef.current[nextPageIndex]);
      setPageIndex(nextPageIndex);
      return;
    }

    setLoading(true);
    try {
      const resolved = await ensureInboxPageCached(
        nextPageIndex,
        nextPageSize,
        totalInquiriesCount,
      );

      if (resolved && pageCacheRef.current[nextPageIndex]) {
        setPagedInquiries(pageCacheRef.current[nextPageIndex]);
        setPageIndex(nextPageIndex);
      }

      if (
        resolved &&
        (nextPageIndex + 1) * nextPageSize < totalInquiriesCount
      ) {
        void prefetchInboxPage(
          nextPageIndex + 1,
          nextPageSize,
          totalInquiriesCount,
        );
      }
    } catch (error) {
      toast.error("Failed to load the next inquiry page.");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setStatusFilter(settings.defaultInquiryStatus);
  }, [settings.defaultInquiryStatus]);

  const sortedInquiries = useMemo(
    () =>
      [...inquiries].sort(
        (a, b) => getCreatedAtMillis(b) - getCreatedAtMillis(a),
      ),
    [inquiries],
  );

  const filteredInquiries = useMemo(
    () =>
      searchInquiries(
        searchValue,
        sortedInquiries.filter((inquiry) => {
          const key = getInquiryDocId(inquiry);
          return statusFilter ? inquiryStatus[key] === statusFilter : true;
        }),
      ),
    [inquiryStatus, searchValue, sortedInquiries, statusFilter],
  );
  const serverPaginationEnabled = serverPaginationEligible;
  const inboxSourceInquiries = serverPaginationEnabled
    ? pagedInquiries
    : filteredInquiries;
  const inboxVisibleCount = serverPaginationEnabled
    ? totalInquiriesCount
    : filteredInquiries.length;
  const totalInquiries = sortedInquiries.length;

  useEffect(() => {
    if (!serverPaginationEnabled || !liveInquiriesReady) return;

    const totalPages = Math.max(
      Math.ceil(sortedInquiries.length / pageSize),
      1,
    );
    if (pageIndex > totalPages - 1) {
      setPageIndex(totalPages - 1);
      return;
    }

    const start = pageIndex * pageSize;
    const end = start + pageSize;
    setPagedInquiries(sortedInquiries.slice(start, end));
  }, [
    liveInquiriesReady,
    pageIndex,
    pageSize,
    serverPaginationEnabled,
    sortedInquiries,
  ]);

  const unprocessedCount = sortedInquiries.filter((inquiry) => {
    const key = getInquiryDocId(inquiry);
    return (inquiryStatus[key] ?? "unprocessed") === "unprocessed";
  }).length;
  const completedCount = sortedInquiries.filter((inquiry) => {
    const key = getInquiryDocId(inquiry);
    return (inquiryStatus[key] ?? "unprocessed") === "completed";
  }).length;
  const newTodayCount = useMemo(() => {
    const todayKey = new Date().toDateString();
    return sortedInquiries.filter((inquiry) => {
      const ms = getCreatedAtMillis(inquiry);
      return ms > 0 && new Date(ms).toDateString() === todayKey;
    }).length;
  }, [sortedInquiries]);
  const recentWindowCounts = useMemo(() => {
    const now = Date.now();
    const dayMs = 1000 * 60 * 60 * 24;
    let currentWeek = 0;
    let previousWeek = 0;

    sortedInquiries.forEach((inquiry) => {
      const createdAt = getCreatedAtMillis(inquiry);
      if (!createdAt) return;

      const age = now - createdAt;
      if (age >= 0 && age < dayMs * 7) {
        currentWeek += 1;
      } else if (age >= dayMs * 7 && age < dayMs * 14) {
        previousWeek += 1;
      }
    });

    return { currentWeek, previousWeek };
  }, [sortedInquiries]);
  const weeklyTrend = useMemo(() => {
    const { currentWeek, previousWeek } = recentWindowCounts;
    if (previousWeek === 0) {
      if (currentWeek === 0) return 0;
      return 100;
    }
    return Math.round(((currentWeek - previousWeek) / previousWeek) * 100);
  }, [recentWindowCounts]);
  const completionRate = totalInquiries
    ? Math.round((completedCount / totalInquiries) * 100)
    : 0;
  const pendingRate = totalInquiries
    ? Math.round((unprocessedCount / totalInquiries) * 100)
    : 0;
  const dashboardStats = [
    {
      label: "Total inquiries",
      value: totalInquiries,
      badge: `${weeklyTrend >= 0 ? "+" : ""}${weeklyTrend}%`,
      badgeIcon: weeklyTrend >= 0 ? IconTrendingUp : IconTrendingDown,
      badgeVariant: weeklyTrend >= 0 ? "up" : "down",
      footerTitle:
        weeklyTrend >= 0
          ? "Trending above the prior week"
          : "Running below the prior week",
      footerBody: `${recentWindowCounts.currentWeek} inquiries in the last 7 days`,
    },
    {
      label: "Unprocessed",
      value: unprocessedCount,
      badge: `${pendingRate}%`,
      badgeIcon: IconTrendingDown,
      badgeVariant: "neutral",
      footerTitle: "Pending follow-up",
      footerBody: `${pendingRate}% of the inbox still needs a response`,
    },
    {
      label: "Completed",
      value: completedCount,
      badge: `${completionRate}%`,
      badgeIcon: IconTrendingUp,
      badgeVariant: "up",
      footerTitle: "Closed and converted",
      footerBody: `${completionRate}% of inquiries are marked completed`,
    },
    {
      label: "New today",
      value: newTodayCount,
      badge: newTodayCount > 0 ? "Live" : "Quiet",
      badgeIcon: newTodayCount > 0 ? IconTrendingUp : IconTrendingDown,
      badgeVariant: newTodayCount > 0 ? "up" : "neutral",
      footerTitle:
        newTodayCount > 0 ? "Fresh activity today" : "No new inquiries today",
      footerBody: "Today resets at midnight local time",
    },
  ];

  const inboxRows = useMemo<InquiryInboxRow[]>(
    () =>
      inboxSourceInquiries.map((inquiry, index) => {
        const docKey = getInquiryDocId(inquiry);
        const displayNumber =
          getStableInquiryNumber(inquiry) ??
          (serverPaginationEnabled
            ? Math.max(totalInquiriesCount - pageIndex * pageSize - index, 1)
            : filteredInquiries.length - index);
        const fullName = [inquiry.firstName, inquiry.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();
        const inquiryLabel = fullName || inquiry.email || "Unknown inquiry";
        const eventLabel =
          inquiry.eventName ||
          inquiry.package ||
          inquiry.reference ||
          "Untitled event";
        const contactLabel = inquiry.email || "No email";

        return {
          inquiry,
          displayNumber,
          docKey,
          isUnread: !viewedInquiryIds[docKey],
          receivedAt: formatDateTime(
            inquiry.createdAt ?? inquiry.created_at ?? inquiry.dateCreated,
          ),
          eventDate: inquiry.eventDate || "Date TBD",
          eventTime:
            inquiry.startTime && inquiry.endTime
              ? `${convertTo12HourFormat(inquiry.startTime)} - ${convertTo12HourFormat(
                  inquiry.endTime,
                )}`
              : inquiry.startTime
                ? convertTo12HourFormat(inquiry.startTime)
                : "Time TBD",
          inquiryLabel,
          eventLabel,
          contactLabel,
          guestCount: inquiry.plannedGuestCount || "TBD",
          status: (inquiryStatus[docKey] ?? "unprocessed") as InquiryStatus,
          matchStatus: inquiry.matchStatus ?? null,
        };
      }),
    [
      filteredInquiries.length,
      inboxSourceInquiries,
      inquiryStatus,
      pageIndex,
      pageSize,
      serverPaginationEnabled,
      totalInquiriesCount,
      viewedInquiryIds,
    ],
  );
  const openModal = openInquiryPreview;

  const handleInquiryUpdated = (updatedInquiry: Inquiry) => {
    const updatedKey = getInquiryDocId(updatedInquiry);
    if (!updatedKey) return;

    const mergeInquiry = (items: Inquiry[]) =>
      items.map((item) =>
        getInquiryDocId(item) === updatedKey
          ? { ...item, ...updatedInquiry }
          : item,
      );

    setInquiries((prev) => mergeInquiry(prev));
    setPagedInquiries((prev) => mergeInquiry(prev));
    pageCacheRef.current = Object.fromEntries(
      Object.entries(pageCacheRef.current).map(([page, items]) => [
        page,
        mergeInquiry(items),
      ]),
    );
    setSelectedInquiry((prev) =>
      prev && getInquiryDocId(prev) === updatedKey
        ? { ...prev, ...updatedInquiry }
        : prev,
    );
  };

  const closeModal = () => {
    setSelectedInquiry(null);
    setSelectedInquiryNumber(null);
  };

  const showUnprocessed = statusFilter !== "completed";
  const showCompleted = statusFilter !== "unprocessed";

  const updateStatusFilterFromChecks = (
    nextShowUnprocessed: boolean,
    nextShowCompleted: boolean,
  ) => {
    if (nextShowUnprocessed && nextShowCompleted) {
      setStatusFilter("");
      return;
    }

    if (nextShowUnprocessed) {
      setStatusFilter("unprocessed");
      return;
    }

    if (nextShowCompleted) {
      setStatusFilter("completed");
      return;
    }

    setStatusFilter("");
  };

  useEffect(() => {
    if (location.hash !== "#inquiry-inbox") return;
    if (loading) return;
    if (shouldLoadAnalytics && analyticsLoading) return;

    const timeoutId = window.setTimeout(() => {
      document
        .getElementById("inquiry-inbox")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);

    return () => window.clearTimeout(timeoutId);
  }, [analyticsLoading, loading, location.hash, shouldLoadAnalytics]);

  const ALLOWED_STATUSES = ["unprocessed", "completed"] as const;
  const isStatus = (val: unknown): val is InquiryStatus =>
    typeof val === "string" &&
    (ALLOWED_STATUSES as readonly string[]).includes(val);
  const isStatusFilter = (val: unknown): val is "" | InquiryStatus =>
    val === "" || isStatus(val);

  async function handleStatusChange(
    inquiryId: string | number,
    newStatus: InquiryStatus,
    inquiryNumber?: number,
  ) {
    // Normalize and validate status coming from the Select (defensive against undefined)
    const normalizedStatus: InquiryStatus = isStatus(newStatus)
      ? newStatus
      : "unprocessed";
    const idKey = String(inquiryId ?? "").trim();
    if (!idKey) {
      console.error("Missing Firestore document id for status change");
      toast.error("Missing document id; cannot update status.");
      return;
    }

    const prevStatus = inquiryStatus[idKey] ?? "unprocessed";

    // Optimistic UI
    setInquiryStatus((prev) => ({ ...prev, [idKey]: normalizedStatus }));
    setSavingStatus((prev) => ({ ...prev, [idKey]: true }));

    try {
      const toastNumber =
        typeof inquiryNumber === "number"
          ? inquiryNumber
          : (selectedInquiryNumber ?? null);

      if (DEMO_MODE_ENABLED) {
        toast.success("Status changed!", {
          description:
            toastNumber != null
              ? `Inquiry #${toastNumber} updated locally for demo mode`
              : "Inquiry status updated locally for demo mode",
        });
        return;
      }

      const inquiryRef = doc(database, "eventInquiries", idKey);
      await updateDoc(inquiryRef, { status: normalizedStatus });
      console.log("Status updated for", idKey, "->", normalizedStatus);

      toast.success("Status changed!", {
        description:
          toastNumber != null
            ? `Inquiry #${toastNumber} status changed to ${normalizedStatus}`
            : `Status changed to ${normalizedStatus}`,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              setInquiryStatus((prev) => ({ ...prev, [idKey]: prevStatus }));
              setSavingStatus((prev) => ({ ...prev, [idKey]: true }));
              const inquiryRef = doc(database, "eventInquiries", idKey);
              await updateDoc(inquiryRef, { status: prevStatus });
              console.log(`Status reverted for ${idKey} -> ${prevStatus}`);
            } catch (error) {
              console.error("Error reverting status:", error);
              toast.error("Failed to revert status.");
            } finally {
              setSavingStatus((prev) => ({ ...prev, [idKey]: false }));
            }
          },
        },
      });
    } catch (error) {
      console.error("Error updating status:", error);
      setInquiryStatus((prev) => ({ ...prev, [idKey]: prevStatus }));
      toast.error("Failed to update status on the server.");
    } finally {
      setSavingStatus((prev) => ({ ...prev, [idKey]: false }));
    }
  }

  function requestDeleteInquiry(inquiry: Inquiry, inquiryNumber: number) {
    const docKey = getInquiryDocId(inquiry);
    if (!docKey) {
      toast.error(
        "This inquiry cannot be deleted because it has no document id.",
      );
      return;
    }
    setPendingDelete({ inquiry, inquiryNumber });
  }

  async function handleDeleteInquiry() {
    if (!pendingDelete) return;

    const { inquiry, inquiryNumber } = pendingDelete;
    const docKey = getInquiryDocId(inquiry);
    if (!docKey) {
      toast.error(
        "This inquiry cannot be deleted because it has no document id.",
      );
      setPendingDelete(null);
      return;
    }

    try {
      setDeletingInquiry(true);
      if (!DEMO_MODE_ENABLED) {
        await deleteDoc(doc(database, "eventInquiries", docKey));
      }

      setInquiries((prev) =>
        prev.filter((item) => getInquiryDocId(item) !== docKey),
      );
      setPagedInquiries((prev) =>
        prev.filter((item) => getInquiryDocId(item) !== docKey),
      );
      pageCacheRef.current = Object.fromEntries(
        Object.entries(pageCacheRef.current).map(([key, items]) => [
          key,
          items.filter((item) => getInquiryDocId(item) !== docKey),
        ]),
      );
      setTotalInquiriesCount((prev) => Math.max(prev - 1, 0));
      setInquiryStatus((prev) => {
        const next = { ...prev };
        delete next[docKey];
        return next;
      });
      setSavingStatus((prev) => {
        const next = { ...prev };
        delete next[docKey];
        return next;
      });

      if (getInquiryDocId(selectedInquiry) === docKey) {
        closeModal();
      }

      toast.success(
        DEMO_MODE_ENABLED
          ? `Inquiry #${inquiryNumber} removed from the local demo list.`
          : `Inquiry #${inquiryNumber} deleted.`,
      );
      setPendingDelete(null);
    } catch (error) {
      console.error("Error deleting inquiry:", error);
      toast.error("Failed to delete inquiry.");
    } finally {
      setDeletingInquiry(false);
    }
  }

  return (
    <>
      <section className="space-y-6">
        {settings.showDashboardSummary && !analyticsLoading && (
          <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs md:grid-cols-2 xl:grid-cols-4 dark:*:data-[slot=card]:bg-card">
            {dashboardStats.map((stat) => {
              const TrendIcon = stat.badgeIcon;
              const badgeClassName =
                stat.badgeVariant === "up"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : stat.badgeVariant === "down"
                    ? "text-rose-700 dark:text-rose-300"
                    : "text-muted-foreground";

              return (
                <Card key={stat.label} className="@container/card">
                  <CardHeader>
                    <CardDescription>{stat.label}</CardDescription>
                    <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                      {stat.value}
                    </CardTitle>
                    <CardAction>
                      <Badge variant="outline" className={badgeClassName}>
                        <TrendIcon className="size-4" />
                        {stat.badge}
                      </Badge>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="flex-col items-start gap-1.5 text-sm">
                    <div className="line-clamp-1 flex items-center gap-2 font-medium">
                      {stat.footerTitle}
                      <TrendIcon className="size-4" />
                    </div>
                    <div className="text-muted-foreground">
                      {stat.footerBody}
                    </div>
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        )}

        {settings.showInquiryGraph && !analyticsLoading && (
          <InquiryVolumeChart
            inquiries={sortedInquiries}
            defaultRange={settings.defaultInquiryGraphRange}
          />
        )}

        <section id="inquiry-inbox" className="space-y-6 scroll-mt-20">
          <div className="space-y-4">
            <div>
              <CardTitle className="text-2xl">Inquiry Inbox</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {inboxVisibleCount} visible inquir
                {inboxVisibleCount === 1 ? "y" : "ies"} across the current
                search and status filters.
              </p>
              {DEMO_MODE_ENABLED && (
                <p className="mt-2 text-sm text-muted-foreground">
                  Showing synthetic demo inquiries only. Inbox status changes stay
                  local to this demo session.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    <ListFilter className="size-4" />
                    Filter
                    {isStatusFilter(statusFilter) && statusFilter !== "" && (
                      <Badge variant="secondary" className="ml-1 px-1.5">
                        1
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52">
                  <DropdownMenuLabel>Status</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem
                    checked={showUnprocessed}
                    onCheckedChange={(checked) =>
                      updateStatusFilterFromChecks(
                        Boolean(checked),
                        showCompleted,
                      )
                    }
                  >
                    Unprocessed
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuCheckboxItem
                    checked={showCompleted}
                    onCheckedChange={(checked) =>
                      updateStatusFilterFromChecks(
                        showUnprocessed,
                        Boolean(checked),
                      )
                    }
                  >
                    Completed
                  </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div className="w-full lg:max-w-[520px]">
                <Field
                  orientation="horizontal"
                  className="w-full min-w-[360px]"
                >
                  <Input
                    className="h-9 w-full"
                    onChange={(e) => {
                      e.preventDefault();
                      setSearchValue(e.currentTarget.value);
                    }}
                    type="search"
                    name="inquirySearch"
                    id="inquirySearch"
                    placeholder="Search by name, event, email, notes..."
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setSearchValue((value) => value)}
                  >
                    Search
                  </Button>
                </Field>
              </div>
            </div>
          </div>

          <InquiryInboxTable
            rows={inboxRows}
            loading={serverPaginationEnabled ? loading : analyticsLoading}
            showMatchBadges={settings.showInquiryMatchBadges}
            manualPagination={serverPaginationEnabled}
            pageIndex={pageIndex}
            pageSize={pageSize}
            pageCount={Math.max(Math.ceil(totalInquiriesCount / pageSize), 1)}
            totalRows={inboxVisibleCount}
            canPreviousPage={pageIndex > 0}
            canNextPage={(pageIndex + 1) * pageSize < totalInquiriesCount}
            onPageIndexChange={(nextPageIndex) => {
              if (serverPaginationEnabled) {
                void loadInboxPage(nextPageIndex);
              }
            }}
            onPageSizeChange={(nextPageSize) => {
              pageCacheRef.current = {};
              pageCursorRef.current = [null];
              setPageSize(nextPageSize as InboxPageSize);
            }}
            savingStatus={savingStatus}
            onOpenInquiry={openModal}
            onRequestDelete={requestDeleteInquiry}
            onStatusChange={(inquiryId, newStatus, inquiryNumber) =>
              handleStatusChange(inquiryId, newStatus, inquiryNumber)
            }
          />
        </section>

        {/* inquiryNumber prefers a dedicated persisted inquiryNumber, then numeric docId */}
        {selectedInquiry && (
          <InquiryModal
            inquiry={selectedInquiry}
            open={!!selectedInquiry}
            onClose={closeModal}
            inquiryNumber={selectedInquiryNumber ?? undefined}
            onInquiryUpdated={handleInquiryUpdated}
          />
        )}

        <AlertDialog
          open={!!pendingDelete}
          onOpenChange={(open) => {
            if (!open && !deletingInquiry) setPendingDelete(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete inquiry</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete{" "}
                <span className="font-medium">
                  {pendingDelete
                    ? `Inquiry #${pendingDelete.inquiryNumber}`
                    : "this inquiry"}
                </span>
                .
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                className="cursor-pointer"
                onClick={() => setPendingDelete(null)}
                disabled={deletingInquiry}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-accent hover:bg-destructive/90 cursor-pointer"
                onClick={handleDeleteInquiry}
                disabled={deletingInquiry}
              >
                {deletingInquiry ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </section>
    </>
  );
}

export default Inquiries;
