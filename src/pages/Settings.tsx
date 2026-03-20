import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { database, storage } from "@/utils/firebaseConfig";
import { useAuth } from "@/auth/AuthContext";
import {
  createWorkspaceUser,
  deleteWorkspaceUser,
  getAdminStatus,
  listWorkspaceUsers,
  type AdminStatus,
  type WorkspaceUser,
  updateWorkspaceUser,
} from "@/data/adminUsers";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import {
  CONTRACT_TEMPLATE_OPTIONS,
  INQUIRY_TEMPLATE_TAGS,
  renderInquiryTemplate,
} from "@/utils/helpers/helpers";
import type { Inquiry } from "@/shared-types";
import {
  subscribeContractTemplateOverrides,
  uploadContractTemplateOverride,
  type ContractTemplateOverride,
} from "@/data/contractTemplates";
import type { ContractType } from "@/utils/helpers/helpers";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { APP_WORKSPACE_LABEL } from "@/config/appInfo";

const SETTINGS_PREVIEW_INQUIRY: Inquiry = {
  docId: null,
  dateCreated: "",
  firstName: "Avery",
  lastName: "Lee",
  company: "Studio North",
  eventDate: "2026-06-21",
  startTime: "18:00",
  endTime: "20:00",
  siteAddress: "400 Demo Plaza, Suite 200",
  email: "avery@example.com",
  phoneNumber: "(555) 555-0188",
  plannedGuestCount: "85",
  operation: "Truck",
  package: "Premium",
  eventName: "Summer Launch Party",
  reference: "Referral",
  notes: "Need quick line throughput and branded setup if possible.",
  status: "unprocessed",
  clientId: null,
  emailNormalized: null,
  matchStatus: null,
  matchCandidates: null,
};

export default function Settings() {
  const { user } = useAuth();
  const {
    templates,
    loading: templatesLoading,
    create: createTemplate,
    update: updateTemplate,
    remove: removeTemplate,
  } = useEmailTemplates(database);
  const { settings, updateSettings, resetSettings } = useSiteSettings();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);
  const [contractType, setContractType] = useState<ContractType>("basic");
  const [contractFile, setContractFile] = useState<File | null>(null);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [contractOverrides, setContractOverrides] = useState<
    ContractTemplateOverride[]
  >([]);
  const [adminStatus, setAdminStatus] = useState<AdminStatus | null>(null);
  const [adminStatusLoading, setAdminStatusLoading] = useState(false);
  const [, setAdminStatusError] = useState<string | null>(null);
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserDisplayName, setNewUserDisplayName] = useState("");
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false);
  const [creatingWorkspaceUser, setCreatingWorkspaceUser] = useState(false);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
  const [workspaceUsersLoading, setWorkspaceUsersLoading] = useState(false);
  const [workspaceUsersError, setWorkspaceUsersError] = useState<string | null>(null);
  const [userNameDrafts, setUserNameDrafts] = useState<Record<string, string>>({});
  const [savingWorkspaceUserId, setSavingWorkspaceUserId] = useState<string | null>(
    null,
  );
  const [deletingWorkspaceUserId, setDeletingWorkspaceUserId] = useState<
    string | null
  >(null);
  const [pendingDeleteWorkspaceUser, setPendingDeleteWorkspaceUser] =
    useState<WorkspaceUser | null>(null);
  const templateBodyRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const unsub = subscribeContractTemplateOverrides(database, {
      onData: setContractOverrides,
      onError: (err) =>
        toast.error(`Failed to load contract template overrides: ${String(err)}`),
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) {
      setAdminStatus(null);
      setAdminStatusError(null);
      setWorkspaceUsers([]);
      setWorkspaceUsersError(null);
      return;
    }

    let cancelled = false;
    setAdminStatusLoading(true);
    setAdminStatusError(null);

    getAdminStatus()
      .then((status) => {
        if (cancelled) return;
        setAdminStatus(status);
      })
      .catch((error) => {
        if (cancelled) return;
        setAdminStatus(null);
        setAdminStatusError(
          error instanceof Error ? error.message : "Failed to verify admin access.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setAdminStatusLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!adminStatus?.isAdmin) {
      setWorkspaceUsers([]);
      setWorkspaceUsersError(null);
      return;
    }

    let cancelled = false;
    setWorkspaceUsersLoading(true);
    setWorkspaceUsersError(null);

    listWorkspaceUsers()
      .then((users) => {
        if (cancelled) return;
        setWorkspaceUsers(users);
        setUserNameDrafts(
          Object.fromEntries(
            users.map((workspaceUser) => [
              workspaceUser.uid,
              workspaceUser.displayName ?? "",
            ]),
          ),
        );
      })
      .catch((error) => {
        if (cancelled) return;
        setWorkspaceUsers([]);
        setWorkspaceUsersError(
          error instanceof Error ? error.message : "Failed to load workspace users.",
        );
      })
      .finally(() => {
        if (cancelled) return;
        setWorkspaceUsersLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [adminStatus?.isAdmin]);

  useEffect(() => {
    if (templates.length === 0) {
      setSelectedTemplateId("");
      return;
    }

    if (!selectedTemplateId) {
      setSelectedTemplateId(templates[0].id);
    }
  }, [selectedTemplateId, templates]);

  const activeTemplate = useMemo(
    () =>
      selectedTemplateId
        ? templates.find((template) => template.id === selectedTemplateId) ?? null
        : null,
    [selectedTemplateId, templates],
  );

  useEffect(() => {
    if (creatingTemplate) return;
    if (!activeTemplate) return;
    setEditingTemplateId(activeTemplate.id);
    setTemplateName(activeTemplate.name);
    setTemplateBody(activeTemplate.body);
  }, [activeTemplate, creatingTemplate]);

  const hasTemplateChanges = useMemo(() => {
    if (creatingTemplate || !activeTemplate) return false;
    return (
      templateName.trim() !== activeTemplate.name.trim() ||
      templateBody !== activeTemplate.body
    );
  }, [activeTemplate, creatingTemplate, templateBody, templateName]);

  const renderedPreview = useMemo(
    () => renderInquiryTemplate(templateBody, SETTINGS_PREVIEW_INQUIRY),
    [templateBody],
  );

  const contractOverrideMap = useMemo(
    () =>
      new Map(
        contractOverrides.map((override) => [override.contractType, override]),
      ),
    [contractOverrides],
  );

  const insertTemplateToken = (token: string) => {
    const textarea = templateBodyRef.current;
    if (!textarea) {
      setTemplateBody((prev) => `${prev}${token}`);
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const nextValue =
      templateBody.slice(0, start) + token + templateBody.slice(end);
    setTemplateBody(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      const nextCursor = start + token.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  };

  const openNewTemplate = () => {
    setCreatingTemplate(true);
    setEditingTemplateId(null);
    setTemplateName("");
    setTemplateBody("");
  };

  const handleCreateTemplate = async () => {
    if (!templateName.trim()) {
      toast.error("Template name is required.");
      return;
    }
    if (!templateBody.trim()) {
      toast.error("Template body is required.");
      return;
    }

    setSavingTemplate(true);
    try {
      const id = await createTemplate({
        name: templateName.trim(),
        body: templateBody,
      });
      setSelectedTemplateId(id);
      setCreatingTemplate(false);
      toast.success("Template created.");
    } catch (err) {
      toast.error(`Failed to create template: ${String(err)}`);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplateId) return;
    if (!templateName.trim()) {
      toast.error("Template name is required.");
      return;
    }

    setSavingTemplate(true);
    try {
      await updateTemplate(editingTemplateId, {
        name: templateName.trim(),
        body: templateBody,
      });
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
      setCreatingTemplate(false);
      setEditingTemplateId(null);
      setSelectedTemplateId("");
      setTemplateName("");
      setTemplateBody("");
      toast.success("Template deleted.");
    } catch (err) {
      toast.error(`Failed to delete template: ${String(err)}`);
    } finally {
      setDeletingTemplate(false);
    }
  };

  const handleUploadContract = async () => {
    if (!contractFile) {
      toast.error("Choose a .docx file first.");
      return;
    }

    if (!contractFile.name.toLowerCase().endsWith(".docx")) {
      toast.error("Only .docx files are supported.");
      return;
    }

    setUploadingContract(true);
    try {
      await uploadContractTemplateOverride({
        db: database,
        storage,
        contractType,
        file: contractFile,
      });
      setContractFile(null);
      toast.success("Contract template uploaded.");
    } catch (err) {
      toast.error(`Failed to upload contract template: ${String(err)}`);
    } finally {
      setUploadingContract(false);
    }
  };

  const handleCreateWorkspaceUser = async () => {
    if (!newUserEmail.trim()) {
      toast.error("Email is required.");
      return;
    }

    if (newUserPassword.trim().length < 8) {
      toast.error("Temporary password must be at least 8 characters.");
      return;
    }

    setCreatingWorkspaceUser(true);
    try {
      const createdUser = await createWorkspaceUser({
        email: newUserEmail,
        password: newUserPassword,
        displayName: newUserDisplayName || undefined,
        isAdmin: newUserIsAdmin,
      });
      toast.success(
        `Created ${createdUser.email}${createdUser.isAdmin ? " with admin access" : ""}.`,
      );
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserDisplayName("");
      setNewUserIsAdmin(false);
      setWorkspaceUsers((prev) => [createdUser, ...prev]);
      setUserNameDrafts((prev) => ({
        ...prev,
        [createdUser.uid]: createdUser.displayName ?? "",
      }));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to create workspace user.",
      );
    } finally {
      setCreatingWorkspaceUser(false);
    }
  };

  const handleSaveWorkspaceUserName = async (workspaceUser: WorkspaceUser) => {
    const nextDisplayName = (userNameDrafts[workspaceUser.uid] ?? "").trim();

    if ((workspaceUser.displayName ?? "") === nextDisplayName) {
      return;
    }

    setSavingWorkspaceUserId(workspaceUser.uid);
    try {
      const updatedUser = await updateWorkspaceUser({
        uid: workspaceUser.uid,
        displayName: nextDisplayName,
      });
      setWorkspaceUsers((prev) =>
        prev.map((item) => (item.uid === updatedUser.uid ? updatedUser : item)),
      );
      setUserNameDrafts((prev) => ({
        ...prev,
        [updatedUser.uid]: updatedUser.displayName ?? "",
      }));
      toast.success(`Updated ${updatedUser.email}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update workspace user.",
      );
    } finally {
      setSavingWorkspaceUserId(null);
    }
  };

  const handleDeleteWorkspaceUser = async (workspaceUser: WorkspaceUser) => {
    if (workspaceUser.uid === user?.uid) {
      toast.error("You cannot delete the account you are currently using.");
      return;
    }

    setDeletingWorkspaceUserId(workspaceUser.uid);
    try {
      await deleteWorkspaceUser(workspaceUser.uid);
      setWorkspaceUsers((prev) =>
        prev.filter((item) => item.uid !== workspaceUser.uid),
      );
      setUserNameDrafts((prev) => {
        const next = { ...prev };
        delete next[workspaceUser.uid];
        return next;
      });
      toast.success(`Deleted ${workspaceUser.email}.`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete workspace user.",
      );
    } finally {
      setDeletingWorkspaceUserId(null);
      setPendingDeleteWorkspaceUser(null);
    }
  };

  return (
    <section className="space-y-6">
      <div id="settings-site-preferences" className="space-y-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Site Settings</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Control dashboard defaults, inbox behavior, and live notification
              preferences.
            </p>
          </div>
          <Button asChild variant="outline" className="md:self-center">
            <Link to="/account">Open account settings</Link>
          </Button>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="space-y-4 xl:col-span-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Inbox And Notifications
            </h3>
            <div className="space-y-2">
              <Label>Default dashboard filter</Label>
              <Select
                value={settings.defaultInquiryStatus || "all"}
                onValueChange={(value) =>
                  updateSettings({
                    defaultInquiryStatus:
                      value === "all"
                        ? ""
                        : (value as "" | "unprocessed" | "completed"),
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All inquiries</SelectItem>
                  <SelectItem value="unprocessed">Unprocessed</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Rows per page</Label>
              <Select
                value={`${settings.inboxPageSize}`}
                onValueChange={(value) =>
                  updateSettings({
                    inboxPageSize: Number(value) as 10 | 20 | 30 | 40,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 rows</SelectItem>
                  <SelectItem value="20">20 rows</SelectItem>
                  <SelectItem value="30">30 rows</SelectItem>
                  <SelectItem value="40">40 rows</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="show-inquiry-match-badges">Match badges</Label>
                <p className="text-sm text-muted-foreground">
                  Show linked, no-match, and review-state badges in the inbox.
                </p>
              </div>
              <Switch
                id="show-inquiry-match-badges"
                checked={settings.showInquiryMatchBadges}
                onCheckedChange={(checked) =>
                  updateSettings({ showInquiryMatchBadges: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="enable-new-inquiry-toasts">Live inquiry toasts</Label>
                <p className="text-sm text-muted-foreground">
                  Show an in-app toast when a new inquiry is submitted.
                </p>
              </div>
              <Switch
                id="enable-new-inquiry-toasts"
                checked={settings.enableNewInquiryToasts}
                onCheckedChange={(checked) =>
                  updateSettings({ enableNewInquiryToasts: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="enable-desktop-notifications">
                  Desktop notifications
                </Label>
                <p className="text-sm text-muted-foreground">
                  Ask the browser for permission and show desktop alerts for new
                  inquiries when the tab is not focused.
                </p>
              </div>
              <Switch
                id="enable-desktop-notifications"
                checked={settings.enableDesktopNotifications}
                onCheckedChange={(checked) =>
                  updateSettings({ enableDesktopNotifications: checked })
                }
              />
            </div>

            <Button variant="outline" onClick={resetSettings}>
              Reset site settings
            </Button>
          </div>

          <div className="space-y-4 xl:col-span-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Dashboard
            </h3>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="show-dashboard-summary">Summary cards</Label>
                <p className="text-sm text-muted-foreground">
                  Show the stat cards at the top of the dashboard.
                </p>
              </div>
              <Switch
                id="show-dashboard-summary"
                checked={settings.showDashboardSummary}
                onCheckedChange={(checked) =>
                  updateSettings({ showDashboardSummary: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="show-inquiry-graph">Inquiry volume chart</Label>
                <p className="text-sm text-muted-foreground">
                  Show the area chart above the inbox.
                </p>
              </div>
              <Switch
                id="show-inquiry-graph"
                checked={settings.showInquiryGraph}
                onCheckedChange={(checked) =>
                  updateSettings({ showInquiryGraph: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Default graph range</Label>
              <Select
                value={settings.defaultInquiryGraphRange}
                onValueChange={(value) =>
                  updateSettings({
                    defaultInquiryGraphRange: value as "week" | "month" | "year",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="year">Year</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 xl:col-span-1">
            <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Appearance
            </h3>
            <div className="space-y-2">
              <Label>Default theme</Label>
              <Select
                value={settings.defaultTheme}
                onValueChange={(value) =>
                  updateSettings({
                    defaultTheme: value as "system" | "light" | "dark",
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">Device</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {adminStatus?.isAdmin ? (
        <>
          <Card id="settings-workspace-access">
            <CardHeader>
              <CardTitle>Workspace Access</CardTitle>
              <p className="text-sm text-muted-foreground">
                Create Firebase Authentication users for internal staff. This action
                is restricted to authorized admins.
              </p>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-2xl border border-border/70 p-4">
                <p className="text-sm font-medium">Current access</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {adminStatusLoading
                    ? "Checking admin permission..."
                    : `Signed in as ${adminStatus.email || "an admin user"}.`}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Plain `npm run dev` does not run the `/api/admin/*` serverless
                  endpoints. Use the deployed app or `vercel dev` when testing this
                  flow locally.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="workspace-user-email">Email</Label>
                  <Input
                    id="workspace-user-email"
                    type="email"
                    value={newUserEmail}
                    onChange={(event) => setNewUserEmail(event.target.value)}
                    placeholder="new.user@company.com"
                    disabled={creatingWorkspaceUser}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="workspace-user-password">Temporary password</Label>
                  <Input
                    id="workspace-user-password"
                    type="password"
                    value={newUserPassword}
                    onChange={(event) => setNewUserPassword(event.target.value)}
                    placeholder="At least 8 characters"
                    disabled={creatingWorkspaceUser}
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="workspace-user-display-name">Display name</Label>
                  <Input
                    id="workspace-user-display-name"
                    value={newUserDisplayName}
                    onChange={(event) => setNewUserDisplayName(event.target.value)}
                    placeholder="Example: Avery Lee"
                    disabled={creatingWorkspaceUser}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 p-4">
                  <div>
                    <Label htmlFor="workspace-user-admin">Admin access</Label>
                    <p className="text-sm text-muted-foreground">
                      Grants access to create additional workspace users.
                    </p>
                  </div>
                  <Switch
                    id="workspace-user-admin"
                    checked={newUserIsAdmin}
                    onCheckedChange={setNewUserIsAdmin}
                    disabled={creatingWorkspaceUser}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  onClick={handleCreateWorkspaceUser}
                  disabled={creatingWorkspaceUser}
                >
                  {creatingWorkspaceUser ? "Creating user..." : "Create workspace user"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Share the temporary password securely, then have the user reset it
                  after first sign-in.
                </p>
              </div>

              <Separator />

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                    Existing users
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Update display names for existing workspace accounts.
                  </p>
                </div>

                {workspaceUsersLoading ? (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    Loading workspace users...
                  </div>
                ) : workspaceUsersError ? (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    {workspaceUsersError}
                  </div>
                ) : workspaceUsers.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                    No workspace users found.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {workspaceUsers.map((workspaceUser) => {
                      const draftName =
                        userNameDrafts[workspaceUser.uid] ??
                        workspaceUser.displayName ??
                        "";
                      const nameChanged =
                        draftName.trim() !== (workspaceUser.displayName ?? "");

                      return (
                        <div
                          key={workspaceUser.uid}
                          className="grid gap-4 rounded-2xl border border-border/70 p-4 lg:grid-cols-[minmax(0,1fr)_220px_auto]"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {workspaceUser.email}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                              <Badge variant={workspaceUser.isAdmin ? "default" : "secondary"}>
                                {workspaceUser.isAdmin ? "Admin" : "User"}
                              </Badge>
                              {workspaceUser.disabled ? (
                                <Badge variant="outline">Disabled</Badge>
                              ) : null}
                              {workspaceUser.lastSignInTime ? (
                                <span>Last sign-in: {workspaceUser.lastSignInTime}</span>
                              ) : (
                                <span>Never signed in</span>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor={`workspace-user-name-${workspaceUser.uid}`}>
                              Display name
                            </Label>
                            <Input
                              id={`workspace-user-name-${workspaceUser.uid}`}
                              value={draftName}
                              onChange={(event) =>
                                setUserNameDrafts((prev) => ({
                                  ...prev,
                                  [workspaceUser.uid]: event.target.value,
                                }))
                              }
                              placeholder="No display name"
                              disabled={savingWorkspaceUserId === workspaceUser.uid}
                            />
                          </div>

                          <div className="flex items-end gap-2">
                            <Button
                              variant="outline"
                              onClick={() => handleSaveWorkspaceUserName(workspaceUser)}
                              disabled={
                                savingWorkspaceUserId === workspaceUser.uid ||
                                deletingWorkspaceUserId === workspaceUser.uid ||
                                !nameChanged
                              }
                            >
                              {savingWorkspaceUserId === workspaceUser.uid
                                ? "Saving..."
                                : "Save"}
                            </Button>
                            <Button
                              variant="destructive"
                              className="text-white"
                              onClick={() => setPendingDeleteWorkspaceUser(workspaceUser)}
                              disabled={
                                deletingWorkspaceUserId === workspaceUser.uid ||
                                workspaceUser.uid === user?.uid
                              }
                            >
                              {deletingWorkspaceUserId === workspaceUser.uid
                                ? "Deleting..."
                                : "Delete"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Separator />
        </>
      ) : null}

      <div className="space-y-6">
        <Card id="settings-email-templates" className="overflow-hidden">
          <CardHeader className="border-b border-border/60">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Email Templates</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Central editor for the templates used from inquiry modals.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={selectedTemplateId}
                  onValueChange={(value) => {
                    setCreatingTemplate(false);
                    setSelectedTemplateId(value);
                  }}
                >
                  <SelectTrigger className="min-w-[240px]">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={openNewTemplate}>
                  New template
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="grid gap-6 p-6 xl:grid-cols-[1fr_0.95fr]">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="settings-template-name">Template name</Label>
                <Input
                  id="settings-template-name"
                  value={templateName}
                  onChange={(event) => setTemplateName(event.target.value)}
                  placeholder="Example: Follow-up with menu options"
                  disabled={templatesLoading}
                />
              </div>

              <div className="space-y-2">
                <Label>Placeholder tags</Label>
                <div className="flex flex-wrap gap-2">
                  {INQUIRY_TEMPLATE_TAGS.map((tag) => (
                    <Badge
                      key={tag.key}
                      variant="outline"
                      className="cursor-pointer border-emerald-200/80 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200"
                      onClick={() => insertTemplateToken(tag.token)}
                    >
                      {tag.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="settings-template-body">Template body</Label>
                <Textarea
                  id="settings-template-body"
                  ref={templateBodyRef}
                  value={templateBody}
                  onChange={(event) => setTemplateBody(event.target.value)}
                  rows={18}
                  placeholder={`Dear {{firstName}},\n\nThanks for your inquiry for {{eventDate}}.`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
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
                  variant="destructive"
                  className="text-white"
                  onClick={handleDeleteTemplate}
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

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Preview
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Preview uses sample inquiry data so placeholder output stays
                  readable while editing.
                </p>
              </div>
              <div className="rounded-3xl border border-rose-200/70 bg-gradient-to-br from-rose-50 via-white to-emerald-50 p-4 shadow-sm dark:border-white/10 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/40">
                <div className="rounded-xl border border-rose-100/80 bg-white/85 px-3 py-2 dark:border-white/10 dark:bg-zinc-950/80">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-medium text-neutral-700 dark:text-zinc-100">
                      {APP_WORKSPACE_LABEL} Mail
                    </span>
                    <span>Preview</span>
                  </div>
                </div>
                <div className="mt-3 rounded-xl border border-emerald-100/80 bg-white/95 p-4 shadow-sm dark:border-emerald-900/40 dark:bg-zinc-950/85">
                  <div className="space-y-1 text-xs text-neutral-600 dark:text-zinc-400">
                    <p>
                      <span className="font-semibold text-neutral-800 dark:text-zinc-100">
                        To:
                      </span>{" "}
                      {SETTINGS_PREVIEW_INQUIRY.email}
                    </p>
                    <p>
                      <span className="font-semibold text-neutral-800 dark:text-zinc-100">
                        Event:
                      </span>{" "}
                      {SETTINGS_PREVIEW_INQUIRY.eventName}
                    </p>
                  </div>
                  <Separator className="my-3" />
                  <p className="whitespace-pre-wrap text-sm leading-6 text-neutral-800 dark:text-zinc-100">
                    {renderedPreview || "Template preview will appear here."}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card id="settings-contract-templates">
            <CardHeader>
              <CardTitle>Contract Template Uploads</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Contract slot</Label>
                <Select
                  value={contractType}
                  onValueChange={(value) => setContractType(value as ContractType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRACT_TEMPLATE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract-upload">Upload `.docx` file</Label>
                <Input
                  id="contract-upload"
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={(event) =>
                    setContractFile(event.target.files?.[0] ?? null)
                  }
                />
                <p className="text-sm text-muted-foreground">
                  Uploading a new file overrides the default template used for
                  that contract slot.
                </p>
              </div>

              <Button onClick={handleUploadContract} disabled={uploadingContract}>
                {uploadingContract ? "Uploading..." : "Upload contract template"}
              </Button>

              <Separator />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Active overrides
                </h3>
                <div className="space-y-2">
                  {CONTRACT_TEMPLATE_OPTIONS.map((option) => {
                    const override = contractOverrideMap.get(option.value);
                    return (
                      <div
                        key={option.value}
                        className="rounded-2xl border border-border/70 p-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{option.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {override
                                ? override.fileName
                                : "Using bundled default template"}
                            </p>
                          </div>
                          <Badge variant={override ? "default" : "secondary"}>
                            {override ? "Override" : "Default"}
                          </Badge>
                        </div>
                        {override?.uploadedAtLabel && (
                          <p className="mt-2 text-xs text-muted-foreground">
                            Updated {override.uploadedAtLabel}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog
        open={pendingDeleteWorkspaceUser !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            setPendingDeleteWorkspaceUser(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete workspace user?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeleteWorkspaceUser
                ? `This will permanently remove ${pendingDeleteWorkspaceUser.email} from Firebase Authentication.`
                : "This will permanently remove the selected user from Firebase Authentication."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={
                pendingDeleteWorkspaceUser !== null &&
                deletingWorkspaceUserId === pendingDeleteWorkspaceUser.uid
              }
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!pendingDeleteWorkspaceUser) return;
                void handleDeleteWorkspaceUser(pendingDeleteWorkspaceUser);
              }}
              disabled={
                pendingDeleteWorkspaceUser !== null &&
                deletingWorkspaceUserId === pendingDeleteWorkspaceUser.uid
              }
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pendingDeleteWorkspaceUser !== null &&
              deletingWorkspaceUserId === pendingDeleteWorkspaceUser.uid
                ? "Deleting..."
                : "Delete user"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
