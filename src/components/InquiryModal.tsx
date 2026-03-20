import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChevronDown } from "lucide-react";
import { Inquiry } from "../shared-types";
import {
  INQUIRY_TEMPLATE_TAGS,
  capitalize,
  convertTo12HourFormat,
  generateContract,
  getLabel,
  renderInquiryTemplate,
} from "../utils/helpers/helpers";
import CopyButton from "./CopyButton";
import DraftEmailButton from "./DraftEmailButton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "./ui/collapsible";
import { Label } from "./ui/label";
import { useNewEventDialog } from "@/providers/new-event-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { database } from "@/utils/firebaseConfig";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useClients } from "@/data/clients";
import {
  createClientFromInquiryAndLink,
  linkInquiryToClient,
} from "@/data/inquiryWorkflow";
import {
  APP_WORKSPACE_LABEL,
  DEMO_MODE_ENABLED,
  EMAIL_SUBJECT_PREFIX,
} from "@/config/appInfo";

type InquiryModalProps = {
  inquiry: Inquiry | null;
  open: boolean;
  onClose: () => void;
  inquiryNumber: number;
  onInquiryUpdated?: (inquiry: Inquiry) => void;
};

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
const ZERO_WIDTH_SPACE = "\u200B";
const DROP_CARET_SELECTOR = '[data-drop-caret="true"]';

type TemplateEditorMaps = {
  tokenByKey: Map<string, string>;
  labelByToken: Map<string, string>;
};

const createPlaceholderNode = (
  token: string,
  labelByToken: Map<string, string>,
) => {
  const chip = document.createElement("span");
  chip.setAttribute("data-token", token);
  chip.setAttribute("contenteditable", "false");
  chip.className =
    "mx-0.5 inline-flex items-center rounded-md border border-emerald-200/80 bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200";
  chip.textContent = labelByToken.get(token) ?? token;
  return chip;
};

const createDropCaretNode = () => {
  const caret = document.createElement("span");
  caret.setAttribute("data-drop-caret", "true");
  caret.setAttribute("contenteditable", "false");
  caret.setAttribute("aria-hidden", "true");
  caret.className =
    "mx-0.5 inline-block h-[1.2em] w-[2px] align-middle rounded-full bg-rose-500";
  return caret;
};

const serializeTemplateEditor = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return (node.nodeValue ?? "").split(ZERO_WIDTH_SPACE).join("");
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return "";
  }

  const element = node as HTMLElement;
  if (element.dataset.dropCaret === "true") return "";
  const token = element.dataset.token;
  if (token) return token;

  return Array.from(element.childNodes)
    .map((child) => serializeTemplateEditor(child))
    .join("");
};

const renderTemplateIntoEditor = (
  editor: HTMLElement,
  template: string,
  maps: TemplateEditorMaps,
) => {
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;

  const matcher = new RegExp(PLACEHOLDER_PATTERN.source, "g");
  let match: RegExpExecArray | null = null;
  while ((match = matcher.exec(template)) !== null) {
    const index = match.index;
    const rawKey = (match[1] ?? "").toLowerCase();
    const token = maps.tokenByKey.get(rawKey);

    if (index > lastIndex) {
      fragment.appendChild(
        document.createTextNode(template.slice(lastIndex, index)),
      );
    }

    if (token) {
      fragment.appendChild(createPlaceholderNode(token, maps.labelByToken));
      fragment.appendChild(document.createTextNode(ZERO_WIDTH_SPACE));
    } else {
      fragment.appendChild(document.createTextNode(match[0]));
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < template.length) {
    fragment.appendChild(document.createTextNode(template.slice(lastIndex)));
  }

  editor.replaceChildren(fragment);
};

/**
 *
 * Inquiry Modal
 */
const InquiryModal: React.FC<InquiryModalProps> = ({
  inquiry,
  open,
  onClose,
  inquiryNumber,
  onInquiryUpdated,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<
    string | undefined
  >();
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(
    null,
  );
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [tablesideDialogOpen, setTablesideDialogOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(true);
  const modalRef = useRef<HTMLDivElement>(null);
  const templateEditorRef = useRef<HTMLDivElement>(null);
  const templateBodyRef = useRef("");
  const lastEditorSerializedRef = useRef("");
  const templateDropCaretRef = useRef<HTMLSpanElement | null>(null);
  const templateDragImageRef = useRef<HTMLSpanElement | null>(null);
  const [selectedResolutionClientId, setSelectedResolutionClientId] =
    useState("");
  const [resolvingClientLink, setResolvingClientLink] = useState(false);
  const { openNewEventDialog } = useNewEventDialog();
  const { data: clients = [], isLoading: clientsLoading } = useClients();
  const {
    templates: customTemplates,
    loading: templatesLoading,
    create: createTemplate,
    update: updateTemplate,
    remove: removeTemplate,
  } = useEmailTemplates(database);
  const defaultClientId = inquiry?.clientId ?? undefined;
  const selectedTemplateValue = selectedTemplate ?? "";
  const renderedTextStyle = {
    fontFamily: '"Poppins", "Geist Sans", sans-serif',
  } as const;
  const editorMaps = useMemo<TemplateEditorMaps>(() => {
    const tokenByKey = new Map(
      INQUIRY_TEMPLATE_TAGS.map((tag) => [tag.key.toLowerCase(), tag.token]),
    );
    const labelByToken = new Map(
      INQUIRY_TEMPLATE_TAGS.map((tag) => [tag.token, tag.label]),
    );
    return { tokenByKey, labelByToken };
  }, []);
  const linkedClient = useMemo(
    () =>
      inquiry.clientId
        ? (clients.find((client) => client.id === inquiry.clientId) ?? null)
        : null,
    [clients, inquiry.clientId],
  );
  const candidateClients = useMemo(() => {
    const candidateIds = inquiry.matchCandidates ?? [];
    if (candidateIds.length === 0) return [];
    return candidateIds
      .map((candidateId) => clients.find((client) => client.id === candidateId))
      .filter((client): client is (typeof clients)[number] => Boolean(client));
  }, [clients, inquiry.matchCandidates]);
  const resolutionClientOptions = useMemo(() => {
    const source = candidateClients.length > 0 ? candidateClients : clients;
    const seen = new Set<string>();
    return source.filter((client) => {
      if (seen.has(client.id)) return false;
      seen.add(client.id);
      return true;
    });
  }, [candidateClients, clients]);
  const canCreateEvent =
    inquiry.matchStatus !== "ambiguous_match" || Boolean(inquiry.clientId);
  const clientMatchTone =
    inquiry.matchStatus === "manual_override"
      ? "default"
      : inquiry.matchStatus === "linked"
        ? "secondary"
        : inquiry.matchStatus === "ambiguous_match"
          ? "destructive"
          : "outline";
  const clientMatchLabel =
    inquiry.matchStatus === "manual_override"
      ? "Manual override"
      : inquiry.matchStatus === "linked"
        ? "Linked"
        : inquiry.matchStatus === "ambiguous_match"
          ? "Needs review"
          : inquiry.matchStatus === "no_match"
            ? "No match"
            : "Unlinked";
  const clientMatchDescription =
    inquiry.matchStatus === "manual_override"
      ? "This inquiry was manually linked to a client."
      : inquiry.matchStatus === "linked"
        ? "This inquiry is already linked to an existing client."
        : inquiry.matchStatus === "ambiguous_match"
          ? "Multiple client matches were found. Choose the right client before creating an event."
          : inquiry.matchStatus === "no_match"
            ? "No exact client match was found yet. You can create a new client from this inquiry."
            : "This inquiry has not been assigned to a client yet.";
  const selectedResolutionClient = useMemo(
    () =>
      selectedResolutionClientId
        ? (clients.find((client) => client.id === selectedResolutionClientId) ??
          null)
        : null,
    [clients, selectedResolutionClientId],
  );

  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  useEffect(() => {
    const fallbackClientId =
      inquiry.clientId ??
      (candidateClients.length === 1 ? candidateClients[0].id : "") ??
      "";

    setSelectedResolutionClientId((currentValue) => {
      if (
        currentValue &&
        resolutionClientOptions.some((client) => client.id === currentValue)
      ) {
        return currentValue;
      }
      return fallbackClientId;
    });
  }, [candidateClients, inquiry.clientId, resolutionClientOptions]);

  useEffect(() => {
    templateBodyRef.current = templateBody;
  }, [templateBody]);

  const handleTemplateEditorRef = useCallback(
    (node: HTMLDivElement | null) => {
      templateEditorRef.current = node;
      if (!node) return;
      const currentBody = templateBodyRef.current;
      renderTemplateIntoEditor(node, currentBody, editorMaps);
      lastEditorSerializedRef.current = currentBody;
    },
    [editorMaps],
  );

  useEffect(() => {
    if (!templateEditorOpen) return;
    requestAnimationFrame(() => {
      templateEditorRef.current?.focus();
    });
  }, [templateEditorOpen]);

  useEffect(() => {
    const editor = templateEditorRef.current;
    if (!editor || !templateEditorOpen) return;
    const editorAlreadyHydrated = editor.childNodes.length > 0;
    if (
      document.activeElement === editor &&
      lastEditorSerializedRef.current === templateBody &&
      editorAlreadyHydrated
    ) {
      return;
    }
    renderTemplateIntoEditor(editor, templateBody, editorMaps);
    lastEditorSerializedRef.current = templateBody;
  }, [editorMaps, templateBody, templateEditorOpen]);

  const displayOrder = [
    "firstName",
    "lastName",
    "company",
    "eventDate",
    "startTime",
    "endTime",
    "siteAddress",
    "email",
    "phoneNumber",
    "plannedGuestCount",
    "operation",
    "package",
    "eventName",
    "reference",
    "notes",
  ];

  useEffect(() => {
    if (customTemplates.length === 0) {
      setSelectedTemplate(undefined);
      return;
    }
    if (!selectedTemplate && !creatingTemplate) {
      setSelectedTemplate(customTemplates[0].id);
      return;
    }
    const hasSelectedTemplate = customTemplates.some(
      (template) => template.id === selectedTemplate,
    );
    if (!hasSelectedTemplate) {
      setSelectedTemplate(customTemplates[0].id);
    }
  }, [creatingTemplate, customTemplates, selectedTemplate]);

  const activeTemplate = useMemo(
    () =>
      selectedTemplate
        ? (customTemplates.find(
            (template) => template.id === selectedTemplate,
          ) ?? null)
        : null,
    [customTemplates, selectedTemplate],
  );
  const hasTemplateChanges = useMemo(() => {
    if (creatingTemplate || !activeTemplate) return false;
    return (
      templateName.trim() !== activeTemplate.name.trim() ||
      templateBody !== activeTemplate.body
    );
  }, [activeTemplate, creatingTemplate, templateBody, templateName]);

  const renderedEmailBody = useMemo(() => {
    if (!inquiry) return "";
    return renderInquiryTemplate(activeTemplate?.body ?? "", inquiry);
  }, [activeTemplate, inquiry]);
  const renderedTemplateEditorBody = useMemo(() => {
    if (!inquiry) return "";
    return renderInquiryTemplate(templateBody, inquiry);
  }, [inquiry, templateBody]);
  const previewSubject = useMemo(() => {
    const recipientName = inquiry.company
      ? inquiry.company
      : `${inquiry.firstName} ${inquiry.lastName}`.trim();
    return `${EMAIL_SUBJECT_PREFIX} — ${recipientName || "Inquiry"}`;
  }, [inquiry.company, inquiry.firstName, inquiry.lastName]);
  const previewTimestamp = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date()),
    [],
  );

  useEffect(() => {
    if (creatingTemplate) return;
    if (!activeTemplate) return;
    setCreatingTemplate(false);
    setEditingTemplateId(activeTemplate.id);
    setTemplateName(activeTemplate.name);
    setTemplateBody(activeTemplate.body);
  }, [activeTemplate, creatingTemplate]);

  const resetTemplateEditor = () => {
    setCreatingTemplate(true);
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateBody("");
  };

  const openNewTemplateEditor = () => {
    resetTemplateEditor();
    setTemplateEditorOpen(true);
  };

  const openEditTemplateEditor = () => {
    if (!activeTemplate) {
      toast.error("Select a template first.");
      return;
    }
    setCreatingTemplate(false);
    setEditingTemplateId(activeTemplate.id);
    setTemplateName(activeTemplate.name);
    setTemplateBody(activeTemplate.body);
    setTemplateEditorOpen(true);
  };

  const handleTemplateEditorOpenChange = (isOpen: boolean) => {
    setTemplateEditorOpen(isOpen);
    if (!isOpen && creatingTemplate) {
      setCreatingTemplate(false);
    }
  };

  const getRangeFromPoint = (x: number, y: number): Range | null => {
    const docWithCaret = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
      caretPositionFromPoint?: (
        x: number,
        y: number,
      ) => { offsetNode: Node; offset: number } | null;
    };

    if (typeof docWithCaret.caretRangeFromPoint === "function") {
      return docWithCaret.caretRangeFromPoint(x, y);
    }

    if (typeof docWithCaret.caretPositionFromPoint === "function") {
      const pos = docWithCaret.caretPositionFromPoint(x, y);
      if (!pos) return null;
      const range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.collapse(true);
      return range;
    }

    return null;
  };

  const clearTemplateDropCaret = () => {
    if (templateDropCaretRef.current) {
      templateDropCaretRef.current.remove();
      templateDropCaretRef.current = null;
    }
  };

  const clearTemplateDragImage = () => {
    if (templateDragImageRef.current) {
      templateDragImageRef.current.remove();
      templateDragImageRef.current = null;
    }
  };

  const getTemplateDropCaretRange = (editor: HTMLElement) => {
    const caretNode =
      templateDropCaretRef.current ??
      (editor.querySelector(DROP_CARET_SELECTOR) as HTMLSpanElement | null);
    if (!caretNode) return null;

    const range = document.createRange();
    range.setStartBefore(caretNode);
    range.collapse(true);
    return range;
  };

  const placeTemplateDropCaret = (range: Range) => {
    const editor = templateEditorRef.current;
    if (!editor) return;

    clearTemplateDropCaret();
    const markerRange = range.cloneRange();
    markerRange.collapse(true);

    const caretNode = createDropCaretNode();
    markerRange.insertNode(caretNode);
    templateDropCaretRef.current = caretNode;
  };

  const selectEditorRange = () => {
    const editor = templateEditorRef.current;
    if (!editor) return null;

    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const selectedRange = selection.getRangeAt(0);
      if (editor.contains(selectedRange.commonAncestorContainer)) {
        return selectedRange;
      }
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    return range;
  };

  const commitEditorValue = () => {
    const editor = templateEditorRef.current;
    if (!editor) return;
    const nextValue = serializeTemplateEditor(editor);
    lastEditorSerializedRef.current = nextValue;
    setTemplateBody(nextValue);
  };

  const insertPlainTextAtCursor = (text: string) => {
    if (!text) return;
    const editor = templateEditorRef.current;
    if (!editor) {
      setTemplateBody((prev) => prev + text);
      return;
    }

    editor.focus();
    const range = selectEditorRange();
    if (!range) return;

    range.deleteContents();
    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    const selection = window.getSelection();
    const nextRange = document.createRange();
    nextRange.setStartAfter(textNode);
    nextRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);

    commitEditorValue();
  };

  const insertTokenAtCursor = (
    token: string,
    dropPoint?: { x: number; y: number },
  ) => {
    const editor = templateEditorRef.current;
    if (!editor) {
      setTemplateBody((prev) => prev + token);
      return;
    }

    editor.focus();

    const dropCaretRange = getTemplateDropCaretRange(editor);
    const rangeFromPoint =
      dropCaretRange == null && dropPoint != null
        ? getRangeFromPoint(dropPoint.x, dropPoint.y)
        : null;
    const pointRangeIsInEditor =
      rangeFromPoint != null &&
      editor.contains(rangeFromPoint.commonAncestorContainer);
    const range =
      dropCaretRange ??
      (pointRangeIsInEditor && rangeFromPoint
        ? rangeFromPoint
        : selectEditorRange());
    if (!range) return;

    clearTemplateDropCaret();
    range.deleteContents();

    const tokenNode = createPlaceholderNode(token, editorMaps.labelByToken);
    const spacerNode = document.createTextNode(ZERO_WIDTH_SPACE);
    const fragment = document.createDocumentFragment();
    fragment.appendChild(tokenNode);
    fragment.appendChild(spacerNode);
    range.insertNode(fragment);

    const selection = window.getSelection();
    const nextRange = document.createRange();
    nextRange.setStartAfter(spacerNode);
    nextRange.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(nextRange);

    commitEditorValue();
  };

  const handleTemplateEditorInput = () => {
    commitEditorValue();
  };

  const handleTemplateEditorPaste = (
    event: React.ClipboardEvent<HTMLDivElement>,
  ) => {
    event.preventDefault();
    const pastedText = event.clipboardData.getData("text/plain");
    insertPlainTextAtCursor(pastedText);
  };

  const handleTemplateEditorKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      insertPlainTextAtCursor("\n");
    }
  };

  const handleTemplateDrop = (event: React.DragEvent<HTMLDivElement>) => {
    const token = event.dataTransfer.getData("text/plain");
    clearTemplateDropCaret();
    if (!token || !token.startsWith("{{")) return;
    event.preventDefault();
    insertTokenAtCursor(token, { x: event.clientX, y: event.clientY });
  };

  const handleTemplateDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    const editor = templateEditorRef.current;
    if (!editor) return;

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";

    const range = getRangeFromPoint(event.clientX, event.clientY);
    if (!range || !editor.contains(range.commonAncestorContainer)) {
      clearTemplateDropCaret();
      return;
    }

    placeTemplateDropCaret(range);
  };

  const handleTemplateDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    const nextTarget = event.relatedTarget;
    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }
    clearTemplateDropCaret();
  };

  const handleTemplateTagDragStart = (
    event: React.DragEvent<HTMLSpanElement>,
    token: string,
    label: string,
  ) => {
    event.dataTransfer.setData("text/plain", token);
    event.dataTransfer.effectAllowed = "copy";

    clearTemplateDragImage();
    const dragImage = document.createElement("span");
    dragImage.textContent = label;
    dragImage.className =
      "inline-flex items-center rounded-md border border-emerald-200/60 bg-emerald-50/55 px-1.5 py-0.5 text-xs text-emerald-800/65 shadow-sm";
    dragImage.style.position = "fixed";
    dragImage.style.top = "-1000px";
    dragImage.style.left = "-1000px";
    dragImage.style.pointerEvents = "none";
    document.body.appendChild(dragImage);
    templateDragImageRef.current = dragImage;

    event.dataTransfer.setDragImage(
      dragImage,
      dragImage.offsetWidth / 2,
      dragImage.offsetHeight / 2,
    );
  };

  const handleTemplateTagDragEnd = () => {
    clearTemplateDropCaret();
    clearTemplateDragImage();
  };

  const handleCreateTemplate = async () => {
    const name = templateName.trim();
    if (!name) {
      toast.error("Template name is required.");
      return;
    }
    if (!templateBody.trim()) {
      toast.error("Template body is required.");
      return;
    }

    setSavingTemplate(true);
    try {
      const id = await createTemplate({ name, body: templateBody });
      setCreatingTemplate(false);
      setEditingTemplateId(id);
      setSelectedTemplate(id);
      setTemplateEditorOpen(false);
      toast.success("Template saved.");
    } catch (err) {
      toast.error(`Failed to save template: ${String(err)}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplateId) return;
    const name = templateName.trim();
    if (!name) {
      toast.error("Template name is required.");
      return;
    }

    setSavingTemplate(true);
    try {
      await updateTemplate(editingTemplateId, { name, body: templateBody });
      setTemplateEditorOpen(false);
      toast.success("Template updated.");
    } catch (err) {
      toast.error(`Failed to update template: ${String(err)}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!editingTemplateId) return;

    setDeletingTemplate(true);
    try {
      await removeTemplate(editingTemplateId);
      if (selectedTemplate === editingTemplateId) {
        setSelectedTemplate(undefined);
      }
      setCreatingTemplate(false);
      setConfirmDeleteOpen(false);
      setTemplateEditorOpen(false);
      toast.success("Template deleted.");
    } catch (err) {
      toast.error(`Failed to delete template: ${String(err)}`);
    } finally {
      setDeletingTemplate(false);
    }
  };

  const handleLinkInquiryToClient = async () => {
    if (!selectedResolutionClientId) {
      toast.error("Select a client first.");
      return;
    }

    if (DEMO_MODE_ENABLED) {
      toast.message("Client linking is disabled in demo mode.");
      return;
    }

    setResolvingClientLink(true);
    try {
      const result = await linkInquiryToClient(database, {
        inquiry,
        clientId: selectedResolutionClientId,
      });
      onInquiryUpdated?.(result.inquiry);
      toast.success("Inquiry linked to client.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to link inquiry.",
      );
    } finally {
      setResolvingClientLink(false);
    }
  };

  const handleCreateClientAndLink = async () => {
    if (DEMO_MODE_ENABLED) {
      toast.message("Client creation is disabled in demo mode.");
      return;
    }

    setResolvingClientLink(true);
    try {
      const result = await createClientFromInquiryAndLink(database, inquiry);
      setSelectedResolutionClientId(result.clientId);
      onInquiryUpdated?.(result.inquiry);
      toast.success("Client created and linked to inquiry.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create client.",
      );
    } finally {
      setResolvingClientLink(false);
    }
  };

  if (!inquiry) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[95svh] w-[calc(100vw-1rem)] max-w-none flex-col overflow-y-auto p-4 sm:w-[92vw] sm:p-6 lg:h-[90vh] lg:max-w-[1400px] lg:overflow-hidden">
        <DialogHeader className="space-y-3 lg:relative">
          <DialogTitle className="text-2xl text-neutral-700 dark:text-neutral-50 sm:text-3xl">
            Inquiry #{inquiryNumber} Details
          </DialogTitle>
          <h4 className="hidden rounded-md bg-accent px-2 py-1 text-base font-medium text-neutral-400 lg:absolute lg:left-1/2 lg:top-0 lg:block lg:-translate-x-1/2 lg:text-xl">
            {inquiry.company
              ? inquiry.company
              : `${capitalize(inquiry.firstName)} ${capitalize(inquiry.lastName)}`}
          </h4>
          <DialogDescription className="sr-only">
            View inquiry details, generate contracts, and draft response emails.
          </DialogDescription>
          <div className="flex flex-col gap-2 lg:grid lg:grid-cols-[1fr_auto_1fr] lg:items-center">
            <Badge
              className="date w-fit shadow lg:justify-self-start"
              variant="secondary"
            >
              <p className="text-xs text-neutral-500">
                {inquiry.dateCreated
                  ? (() => {
                      const d = new Date(inquiry.dateCreated);
                      if (Number.isNaN(d.getTime())) return "Date not available";

                      return new Intl.DateTimeFormat("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "2-digit",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(d);
                    })()
                  : "Date not available"}
              </p>
            </Badge>
            <h4 className="w-fit rounded-md bg-accent px-2 py-1 text-base font-medium text-neutral-400 sm:text-xl lg:hidden">
              {inquiry.company
                ? inquiry.company
                : `${capitalize(inquiry.firstName)} ${capitalize(inquiry.lastName)}`}
            </h4>
            <div className="hidden lg:block" aria-hidden="true" />
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4 lg:min-h-0 lg:flex-1 lg:flex-row lg:overflow-hidden">
          <div className="min-w-0 w-full text-sm lg:h-full lg:w-[340px] lg:flex-none lg:overflow-y-auto lg:pr-1">
            <div className="inquiry-details">
              <Card className="w-full mb-4">
                <CardHeader>
                  <CardTitle className="text-lg">Generate contracts</CardTitle>
                  <CardDescription>
                    Generate contract from inquiry details
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Label className="mb-1">Truck contracts</Label>
                  <Popover
                    open={contractDialogOpen}
                    onOpenChange={setContractDialogOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        className="w-fit"
                        variant="outline"
                        size="default"
                      >
                        📄 Download Contracts{" "}
                        <span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M6 11.5L12 17.5L18 11.5"
                              stroke="black"
                              strokeMiterlimit="10"
                            ></path>
                            <path
                              d="M12 17.5V2.5"
                              stroke="black"
                              strokeMiterlimit="10"
                            ></path>
                            <path
                              d="M3 21H21"
                              stroke="black"
                              strokeMiterlimit="10"
                            ></path>
                          </svg>
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="max-w-[420px] w-max"
                      align="start"
                    >
                      <div className="grid gap-1">
                        <h4 className="font-medium leading-none">
                          Download contract
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Select which{" "}
                          <b>
                            <em>truck</em>
                          </b>{" "}
                          contract you want to download
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 mt-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(inquiry, "basic");
                            setContractDialogOpen(false);
                          }}
                        >
                          Basic
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(inquiry, "premium");
                            setContractDialogOpen(false);
                          }}
                        >
                          Premium
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(inquiry, "mini");
                            setContractDialogOpen(false);
                          }}
                        >
                          Mini
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(inquiry, "fundraiser");
                            setContractDialogOpen(false);
                          }}
                        >
                          Fundraiser
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>

                  <Label className="mb-1 mt-6">Tableside contracts</Label>
                  <Popover
                    open={tablesideDialogOpen}
                    onOpenChange={setTablesideDialogOpen}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        className="w-fit"
                        variant="outline"
                        size="default"
                      >
                        📄 Download Contracts{" "}
                        <span>
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M6 11.5L12 17.5L18 11.5"
                              stroke="black"
                              strokeMiterlimit="10"
                            ></path>
                            <path
                              d="M12 17.5V2.5"
                              stroke="black"
                              strokeMiterlimit="10"
                            ></path>
                            <path
                              d="M3 21H21"
                              stroke="black"
                              strokeMiterlimit="10"
                            ></path>
                          </svg>
                        </span>
                      </Button>
                    </PopoverTrigger>

                    <PopoverContent
                      className="max-w-[420px] w-max"
                      align="start"
                    >
                      <div className="grid gap-1">
                        <h4 className="font-medium leading-none">
                          Download contract
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Select which{" "}
                          <b>
                            <em>tableside</em>
                          </b>{" "}
                          contract you want to download
                        </p>
                      </div>

                      <div className="flex flex-col gap-2 mt-3">
                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(inquiry, "tableside-cart-waffle");
                            setTablesideDialogOpen(false);
                          }}
                        >
                          Cart Waffle
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(
                              inquiry,
                              "tableside-catering-cups",
                            );
                            setTablesideDialogOpen(false);
                          }}
                        >
                          Catering Cups
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(
                              inquiry,
                              "tableside-catering-cups-delivery",
                            );
                            setTablesideDialogOpen(false);
                          }}
                        >
                          Catering Cups Delivery
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(
                              inquiry,
                              "tableside-cart-sundae-bar",
                            );
                            setTablesideDialogOpen(false);
                          }}
                        >
                          Cart Sundae Bar
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => {
                            generateContract(
                              inquiry,
                              "tableside-cart-single-cone-dish",
                            );
                            setTablesideDialogOpen(false);
                          }}
                        >
                          Cart Single Cone/Dish
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </CardContent>
              </Card>

              <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                <Card className="mb-4 gap-0">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Details</CardTitle>
                      <CollapsibleTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={
                            detailsOpen
                              ? "Collapse inquiry details"
                              : "Expand inquiry details"
                          }
                        >
                          <ChevronDown
                            className={`size-4 transition-transform ${
                              detailsOpen ? "rotate-180" : ""
                            }`}
                          />
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </CardHeader>
                  <CollapsibleContent>
                    <Separator className="mt-4 mb-4" />
                    <CardContent className="max-h-full overflow-auto">
                      {displayOrder.map((key) => {
                        const value = inquiry[key as keyof Inquiry];
                        const isDateField =
                          key === "dateCreated" || key === "eventDate";
                        const isTimeField =
                          key === "startTime" || key === "endTime";
                        let displayValue;
                        if (isDateField && typeof value === "string") {
                          displayValue = value.split(" GMT")[0];
                        } else if (
                          isTimeField &&
                          typeof value === "string" &&
                          value
                        ) {
                          displayValue = convertTo12HourFormat(value);
                        } else {
                          displayValue = String(value);
                        }
                        return (
                          <p key={key} className="break-words">
                            <span className="font-semibold text-neutral-900 dark:text-accent-foreground">
                              {getLabel(key)}:{" "}
                            </span>
                            <span className="break-words text-neutral-700 dark:text-neutral-300">
                              {displayValue}
                            </span>
                          </p>
                        );
                      })}
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>

              <Card className="hidden w-full mb-4 lg:flex">
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">Client match</CardTitle>
                      <CardDescription>
                        {clientMatchDescription}
                      </CardDescription>
                    </div>
                    <Badge variant={clientMatchTone}>{clientMatchLabel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <Label>Current client</Label>
                    <p className="text-sm text-muted-foreground">
                      {linkedClient
                        ? linkedClient.company ||
                          [linkedClient.firstName, linkedClient.lastName]
                            .filter(Boolean)
                            .join(" ")
                            .trim() ||
                          linkedClient.email
                        : "No linked client yet"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="resolution-client-select">
                      {candidateClients.length > 0
                        ? "Candidate clients"
                        : "Select client"}
                    </Label>
                    <Select
                      value={selectedResolutionClientId}
                      onValueChange={setSelectedResolutionClientId}
                      disabled={
                        clientsLoading ||
                        resolvingClientLink ||
                        resolutionClientOptions.length === 0
                      }
                    >
                      <SelectTrigger id="resolution-client-select">
                        <SelectValue
                          placeholder={
                            clientsLoading
                              ? "Loading clients..."
                              : resolutionClientOptions.length === 0
                                ? "No clients available"
                                : "Select a client"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {resolutionClientOptions.length === 0 ? (
                          <div className="px-2 py-1 text-sm text-muted-foreground">
                            {clientsLoading
                              ? "Loading clients..."
                              : "No clients available"}
                          </div>
                        ) : (
                          resolutionClientOptions.map((client) => {
                            const displayName =
                              client.company ||
                              [client.firstName, client.lastName]
                                .filter(Boolean)
                                .join(" ")
                                .trim() ||
                              client.email;
                            const secondaryLine =
                              client.email ||
                              client.phone ||
                              "No email or phone on file";

                            return (
                              <SelectItem key={client.id} value={client.id}>
                                <div className="flex min-w-0 flex-col">
                                  <span className="truncate">
                                    {displayName}
                                  </span>
                                  <span className="truncate text-xs text-muted-foreground">
                                    {secondaryLine}
                                  </span>
                                </div>
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                    {selectedResolutionClient && (
                      <p className="text-xs text-muted-foreground">
                        Selected:{" "}
                        {selectedResolutionClient.company ||
                          [
                            selectedResolutionClient.firstName,
                            selectedResolutionClient.lastName,
                          ]
                            .filter(Boolean)
                            .join(" ")
                            .trim() ||
                          selectedResolutionClient.email}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="w-fit"
                      variant="outline"
                      size="default"
                      onClick={handleLinkInquiryToClient}
                      disabled={
                        resolvingClientLink ||
                        clientsLoading ||
                        !selectedResolutionClientId
                      }
                    >
                      Link selected client
                    </Button>
                    <Button
                      className="w-fit"
                      variant="secondary"
                      size="default"
                      onClick={handleCreateClientAndLink}
                      disabled={resolvingClientLink}
                    >
                      Create client from inquiry
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="w-full">
                <CardHeader>
                  <CardTitle className="text-lg">Create event</CardTitle>
                  <CardDescription>
                    {canCreateEvent
                      ? "Create a new event from inquiry details"
                      : "Resolve the client match before creating an event"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    className="w-fit"
                    variant="outline"
                    size="default"
                    disabled={!canCreateEvent}
                    onClick={() =>
                      openNewEventDialog(
                        defaultClientId
                          ? { defaultClientId, sourceInquiry: inquiry }
                          : { sourceInquiry: inquiry },
                      )
                    }
                  >
                    New event
                  </Button>
                  {!canCreateEvent && (
                    <p className="text-xs text-muted-foreground">
                      This inquiry has multiple possible client matches. Link
                      the correct client first, then create the event.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="w-full lg:min-h-0 lg:flex-1">
            <div className="flex w-full flex-col rounded-2xl border bg-card text-card-foreground shadow-sm lg:h-full">
              <div className="space-y-4 px-6 pt-6 pb-4">
              <CardTitle>
                <h4 className="text-lg">Email Template Generator</h4>
              </CardTitle>
              <form action="" onSubmit={(e) => e.preventDefault()}>
                <Label>
                  <CardDescription className="font-normal">
                    Select template
                  </CardDescription>
                </Label>
                <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <Select
                    name="template"
                    value={selectedTemplateValue}
                    onValueChange={(v) => {
                      setCreatingTemplate(false);
                      setSelectedTemplate(v || undefined);
                    }}
                  >
                    <SelectTrigger id="template">
                      <SelectValue placeholder="Select a saved template" />
                    </SelectTrigger>
                    <SelectContent>
                      {templatesLoading && (
                        <div className="px-2 py-1 text-sm text-muted-foreground">
                          Loading templates...
                        </div>
                      )}
                      {!templatesLoading && customTemplates.length === 0 && (
                        <div className="px-2 py-1 text-sm text-muted-foreground">
                          No saved templates yet
                        </div>
                      )}
                      {customTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <DraftEmailButton inquiry={inquiry} body={renderedEmailBody} />
                  <CopyButton inquiry={inquiry} body={renderedEmailBody} />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden lg:inline-flex"
                    onClick={openEditTemplateEditor}
                    disabled={!activeTemplate}
                  >
                    Edit template
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden lg:inline-flex"
                    onClick={openNewTemplateEditor}
                  >
                    New template
                  </Button>
                </div>
              </form>
              </div>
              <div className="flex flex-col gap-3 px-6 pb-6 lg:min-h-0 lg:flex-1">
                <Label className="block">Preview</Label>
                <div
                  className="relative min-h-[320px] overflow-auto rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-emerald-50 shadow-[0_8px_24px_rgba(16,24,40,0.08)] lg:min-h-0 lg:flex-1 dark:border-white/10 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/40 dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                style={renderedTextStyle}
                >
                  <div className="flex min-w-0 max-w-full flex-col break-words p-4 pb-6">
                  <div className="mb-3 rounded-xl border border-rose-100/80 bg-white/80 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-zinc-950/80">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                      </div>
                      <span className="font-medium text-neutral-700 dark:text-zinc-100">
                        {APP_WORKSPACE_LABEL} Mail
                      </span>
                      <span>{previewTimestamp}</span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-emerald-100/80 bg-white/95 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-zinc-950/85">
                    <div className="mb-3 space-y-1 text-xs text-neutral-600 dark:text-zinc-400">
                      <p>
                        <span className="font-semibold text-neutral-800 dark:text-zinc-100">
                          From:
                        </span>{" "}
                        {APP_WORKSPACE_LABEL} Team
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-800 dark:text-zinc-100">
                          To:
                        </span>{" "}
                        {inquiry.email || "No recipient email"}
                      </p>
                      <p>
                        <span className="font-semibold text-neutral-800 dark:text-zinc-100">
                          Subject:
                        </span>{" "}
                        {previewSubject}
                      </p>
                    </div>
                    <Separator className="mb-3" />
                    <p className="email-text whitespace-pre-wrap break-words max-w-full text-[14px] leading-6 text-neutral-800 dark:text-zinc-100">
                      {renderedEmailBody}
                    </p>
                  </div>
                </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <Dialog
          open={templateEditorOpen}
          onOpenChange={handleTemplateEditorOpenChange}
        >
          <DialogContent className="flex max-h-[95svh] w-[calc(100vw-1rem)] max-w-none flex-col overflow-hidden p-4 sm:w-[92vw] sm:p-6 lg:h-[90vh] lg:max-w-[1400px]">
            <DialogHeader>
              <DialogTitle>
                {creatingTemplate ? "Create template" : "Edit template"}
              </DialogTitle>
              <DialogDescription>
                Update template name/body and insert inquiry placeholders.
              </DialogDescription>
            </DialogHeader>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="flex flex-col min-h-0 gap-3">
                <div>
                  <Label htmlFor="template-name" className="mb-1 block">
                    Template name
                  </Label>
                  <Input
                    id="template-name"
                    value={templateName}
                    placeholder="Example: Follow-up with menu options"
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Drag placeholder tags into the editor</Label>
                  <div className="flex flex-wrap gap-2">
                    {INQUIRY_TEMPLATE_TAGS.map((tag) => (
                      <Badge
                        key={tag.key}
                        variant="outline"
                        className="cursor-grab active:cursor-grabbing border-emerald-200/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200 dark:hover:bg-emerald-950/45"
                        draggable
                        onDragStart={(event) =>
                          handleTemplateTagDragStart(
                            event,
                            tag.token,
                            tag.label,
                          )
                        }
                        onDragEnd={handleTemplateTagDragEnd}
                        onClick={() => insertTokenAtCursor(tag.token)}
                      >
                        {tag.label}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex flex-col">
                  <Label htmlFor="template-body">Template body</Label>
                  <div
                    id="template-body"
                    ref={handleTemplateEditorRef}
                    contentEditable
                    suppressContentEditableWarning
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Template body"
                    tabIndex={0}
                    onInput={handleTemplateEditorInput}
                    onKeyDown={handleTemplateEditorKeyDown}
                    onPaste={handleTemplateEditorPaste}
                    onDragOver={handleTemplateDragOver}
                    onDragLeave={handleTemplateDragLeave}
                    onDrop={handleTemplateDrop}
                    onBlur={clearTemplateDropCaret}
                    className="border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 mt-1 flex-1 min-h-[260px] w-full overflow-auto rounded-md border bg-transparent px-3 py-2 text-sm leading-relaxed shadow-xs whitespace-pre-wrap break-words transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
                    data-placeholder={`Dear {{firstName}},\n\nThanks for your inquiry for {{eventDate}}.`}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleUpdateTemplate}
                    disabled={
                      creatingTemplate ||
                      !editingTemplateId ||
                      savingTemplate ||
                      deletingTemplate ||
                      !hasTemplateChanges
                    }
                  >
                    Save changes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCreateTemplate}
                    disabled={savingTemplate || deletingTemplate}
                  >
                    Save as new
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="text-white"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={
                      creatingTemplate ||
                      !editingTemplateId ||
                      deletingTemplate ||
                      savingTemplate
                    }
                  >
                    Delete
                  </Button>
                </div>
              </div>

              <div className="flex min-h-[260px] flex-col lg:min-h-0">
                <Label className="mb-1">Rendered preview</Label>
                <ScrollArea
                  className="relative h-full rounded-2xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-emerald-50 shadow-[0_8px_24px_rgba(16,24,40,0.08)] dark:border-white/10 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/40 dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]"
                  style={renderedTextStyle}
                >
                  <div className="flex flex-col break-words min-w-0 max-w-full p-4 pb-6">
                    <div className="mb-3 rounded-xl border border-rose-100/80 bg-white/80 px-3 py-2 shadow-sm dark:border-white/10 dark:bg-zinc-950/80">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                        </div>
                        <span className="font-medium text-neutral-700 dark:text-zinc-100">
                          {APP_WORKSPACE_LABEL} Mail
                        </span>
                        <span>{previewTimestamp}</span>
                      </div>
                    </div>

                    <div className="rounded-xl border border-emerald-100/80 bg-white/95 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-zinc-950/85">
                      <div className="mb-3 space-y-1 text-xs text-neutral-600 dark:text-zinc-400">
                        <p>
                          <span className="font-semibold text-neutral-800 dark:text-zinc-100">
                            From:
                          </span>{" "}
                          {APP_WORKSPACE_LABEL} Team
                        </p>
                        <p>
                          <span className="font-semibold text-neutral-800 dark:text-zinc-100">
                            To:
                          </span>{" "}
                          {inquiry.email || "No recipient email"}
                        </p>
                        <p>
                          <span className="font-semibold text-neutral-800 dark:text-zinc-100">
                            Subject:
                          </span>{" "}
                          {previewSubject}
                        </p>
                      </div>
                      <Separator className="mb-3" />
                      <p className="email-text whitespace-pre-wrap break-words max-w-full text-[14px] leading-6 text-neutral-800 dark:text-zinc-100">
                        {renderedTemplateEditorBody}
                      </p>
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
        <AlertDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
        >
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this template?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deletingTemplate}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteTemplate}
                disabled={deletingTemplate}
                className="bg-destructive text-white hover:bg-destructive/90"
              >
                {deletingTemplate ? "Deleting..." : "Delete"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
};

export default InquiryModal;
