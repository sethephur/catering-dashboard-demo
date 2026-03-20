import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/auth/AuthContext";
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

const formatAuthErrorMessage = (error: unknown, fallback: string) => {
  if (typeof error === "object" && error != null && "code" in error) {
    const code = String((error as { code?: unknown }).code);

    switch (code) {
      case "auth/email-already-in-use":
        return "That email address is already in use.";
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/weak-password":
        return "Use a stronger password with at least 8 characters.";
      case "auth/requires-recent-login":
        return "Sign out and back in, then retry this update.";
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Your current password is incorrect.";
      default:
        break;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
};

const formatTimestamp = (value: string | null | undefined) => {
  if (!value) return "Unavailable";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
};

export default function Account() {
  const {
    isAdmin,
    updateDisplayName,
    updateEmailAddress,
    updatePasswordValue,
    user,
  } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [nextEmail, setNextEmail] = useState("");
  const [emailCurrentPassword, setEmailCurrentPassword] = useState("");
  const [passwordCurrentPassword, setPasswordCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
    setNextEmail(user?.email ?? "");
  }, [user?.displayName, user?.email]);

  const accountInitials = useMemo(() => {
    const source =
      user?.displayName?.trim() || user?.email?.split("@")[0]?.trim() || "HW";

    return source
      .split(/[\s._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("");
  }, [user?.displayName, user?.email]);

  const handleDisplayNameSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDisplayName = displayName.trim();
    if (!trimmedDisplayName) {
      toast.error("Display name cannot be empty.");
      return;
    }

    if (trimmedDisplayName === (user?.displayName ?? "").trim()) {
      toast.message("Your display name is already up to date.");
      return;
    }

    setSavingDisplayName(true);

    try {
      await updateDisplayName(trimmedDisplayName);
      toast.success("Display name updated.");
    } catch (error) {
      toast.error(
        formatAuthErrorMessage(error, "Failed to update your display name."),
      );
    } finally {
      setSavingDisplayName(false);
    }
  };

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedEmail = nextEmail.trim();

    if (!trimmedEmail) {
      toast.error("Email address cannot be empty.");
      return;
    }

    if (!emailCurrentPassword.trim()) {
      toast.error("Enter your current password to update your email.");
      return;
    }

    if (trimmedEmail === (user?.email ?? "").trim()) {
      toast.message("Your email is already up to date.");
      return;
    }

    setSavingEmail(true);

    try {
      await updateEmailAddress(trimmedEmail, emailCurrentPassword);
      setEmailCurrentPassword("");
      toast.success("Email address updated.");
    } catch (error) {
      toast.error(formatAuthErrorMessage(error, "Failed to update your email."));
    } finally {
      setSavingEmail(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!passwordCurrentPassword.trim()) {
      toast.error("Enter your current password first.");
      return;
    }

    if (nextPassword.length < 8) {
      toast.error("Use at least 8 characters for your new password.");
      return;
    }

    if (nextPassword !== confirmPassword) {
      toast.error("Your new password confirmation does not match.");
      return;
    }

    setSavingPassword(true);

    try {
      await updatePasswordValue(nextPassword, passwordCurrentPassword);
      setPasswordCurrentPassword("");
      setNextPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (error) {
      toast.error(
        formatAuthErrorMessage(error, "Failed to update your password."),
      );
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <Card className="border-border/70">
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-sidebar-primary text-lg font-semibold text-sidebar-primary-foreground">
              {accountInitials || "HW"}
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle>Account</CardTitle>
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  {isAdmin ? "Admin" : "User"}
                </Badge>
              </div>
              <CardDescription>
                Update your sign-in credentials and profile details.
              </CardDescription>
            </div>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>{user?.email ?? "No email address"}</p>
            <p>Created {formatTimestamp(user?.metadata.creationTime)}</p>
            <p>Last sign-in {formatTimestamp(user?.metadata.lastSignInTime)}</p>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Display Name</CardTitle>
            <CardDescription>
              This is shown throughout the workspace sidebar and account menu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleDisplayNameSubmit}>
              <div className="space-y-2">
                <Label htmlFor="account-display-name">Display name</Label>
                <Input
                  id="account-display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Your name"
                />
              </div>
              <Button type="submit" disabled={savingDisplayName}>
                {savingDisplayName ? "Saving..." : "Save display name"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle>Email Address</CardTitle>
            <CardDescription>
              Updating your email requires your current password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleEmailSubmit}>
              <div className="space-y-2">
                <Label htmlFor="account-email">New email</Label>
                <Input
                  id="account-email"
                  type="email"
                  autoComplete="email"
                  value={nextEmail}
                  onChange={(event) => setNextEmail(event.target.value)}
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="account-email-password">Current password</Label>
                <Input
                  id="account-email-password"
                  type="password"
                  autoComplete="current-password"
                  value={emailCurrentPassword}
                  onChange={(event) => setEmailCurrentPassword(event.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <Button type="submit" disabled={savingEmail}>
                {savingEmail ? "Updating..." : "Update email"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle>Password</CardTitle>
          <CardDescription>
            Choose a new password, then confirm it before saving.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4 md:grid-cols-3 md:items-end"
            onSubmit={handlePasswordSubmit}
          >
            <div className="space-y-2">
              <Label htmlFor="account-current-password">Current password</Label>
              <Input
                id="account-current-password"
                type="password"
                autoComplete="current-password"
                value={passwordCurrentPassword}
                onChange={(event) => setPasswordCurrentPassword(event.target.value)}
                placeholder="Current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-next-password">New password</Label>
              <Input
                id="account-next-password"
                type="password"
                autoComplete="new-password"
                value={nextPassword}
                onChange={(event) => setNextPassword(event.target.value)}
                placeholder="At least 8 characters"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="account-confirm-password">Confirm password</Label>
              <Input
                id="account-confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                placeholder="Repeat new password"
              />
            </div>
            <div className="md:col-span-3">
              <Button type="submit" disabled={savingPassword}>
                {savingPassword ? "Updating..." : "Update password"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
