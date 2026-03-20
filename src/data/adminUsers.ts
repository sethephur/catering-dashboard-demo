import { auth } from "@/utils/firebaseConfig";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import {
  createStoredDemoWorkspaceUser,
  deleteStoredDemoWorkspaceUser,
  listDemoWorkspaceUsers,
  nextDemoWorkspaceUserId,
  updateStoredDemoWorkspaceUser,
} from "@/data/demoWorkspace";

type AdminApiError = Error & { status?: number };

const createApiError = (message: string, status?: number) => {
  const error = new Error(message) as AdminApiError;
  error.status = status;
  return error;
};

const getAuthorizationHeaders = async () => {
  const user = auth.currentUser;

  if (!user) {
    throw createApiError("You must be signed in to manage workspace users.", 401);
  }

  const token = await user.getIdToken();

  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
};

const parseApiResponse = async (response: Response) => {
  const contentType = response.headers.get("content-type") || "";

  if (!contentType.includes("application/json")) {
    if (!response.ok) {
      throw createApiError(
        "Admin API is unavailable here. Use the deployed app or `vercel dev`.",
        response.status,
      );
    }

    return null;
  }

  const data = await response.json();

  if (!response.ok) {
    throw createApiError(
      typeof data?.error === "string" ? data.error : "Admin request failed.",
      response.status,
    );
  }

  return data;
};

export type AdminStatus = {
  isAdmin: boolean;
  email: string | null;
  uid: string;
};

export type CreateWorkspaceUserInput = {
  email: string;
  password: string;
  displayName?: string;
  isAdmin?: boolean;
};

export type CreateWorkspaceUserResult = {
  uid: string;
  email: string;
  displayName: string | null;
  isAdmin: boolean;
  disabled: boolean;
  creationTime: string | null;
  lastSignInTime: string | null;
};

export type WorkspaceUser = CreateWorkspaceUserResult;

export type UpdateWorkspaceUserInput = {
  uid: string;
  displayName: string;
};

export async function getAdminStatus(): Promise<AdminStatus> {
  if (DEMO_MODE_ENABLED) {
    return {
      isAdmin: true,
      email: "demo.admin@example.com",
      uid: "demo-admin-1",
    };
  }

  const headers = await getAuthorizationHeaders();
  const response = await fetch("/api/admin/status", {
    method: "GET",
    headers,
  });

  return parseApiResponse(response) as Promise<AdminStatus>;
}

export async function createWorkspaceUser(
  input: CreateWorkspaceUserInput,
): Promise<CreateWorkspaceUserResult> {
  if (DEMO_MODE_ENABLED) {
    return createStoredDemoWorkspaceUser({
      uid: nextDemoWorkspaceUserId(),
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName?.trim() || null,
      isAdmin: input.isAdmin === true,
      disabled: false,
      creationTime: new Date().toISOString(),
      lastSignInTime: null,
    });
  }

  const headers = await getAuthorizationHeaders();
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  return parseApiResponse(response) as Promise<CreateWorkspaceUserResult>;
}

export async function listWorkspaceUsers(): Promise<WorkspaceUser[]> {
  if (DEMO_MODE_ENABLED) {
    return listDemoWorkspaceUsers();
  }

  const headers = await getAuthorizationHeaders();
  const response = await fetch("/api/admin/users", {
    method: "GET",
    headers,
  });

  const data = (await parseApiResponse(response)) as { users: WorkspaceUser[] };
  return data.users;
}

export async function updateWorkspaceUser(
  input: UpdateWorkspaceUserInput,
): Promise<WorkspaceUser> {
  if (DEMO_MODE_ENABLED) {
    const updated = updateStoredDemoWorkspaceUser(input.uid, (current) => ({
      ...current,
      displayName: input.displayName.trim() || null,
    }));

    if (!updated) {
      throw createApiError("Demo workspace user not found.", 404);
    }

    return updated;
  }

  const headers = await getAuthorizationHeaders();
  const response = await fetch("/api/admin/users", {
    method: "PATCH",
    headers,
    body: JSON.stringify(input),
  });

  const data = (await parseApiResponse(response)) as { user: WorkspaceUser };
  return data.user;
}

export async function deleteWorkspaceUser(uid: string): Promise<void> {
  if (DEMO_MODE_ENABLED) {
    deleteStoredDemoWorkspaceUser(uid);
    return;
  }

  const headers = await getAuthorizationHeaders();
  const response = await fetch("/api/admin/users", {
    method: "DELETE",
    headers,
    body: JSON.stringify({ uid }),
  });

  await parseApiResponse(response);
}
