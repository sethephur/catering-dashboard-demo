import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const normalizePrivateKey = (value) =>
  typeof value === "string" ? value.replace(/\\n/g, "\n") : "";

const getServiceAccount = () => {
  const json = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;

  if (typeof json === "string" && json.trim().length > 0) {
    const parsed = JSON.parse(json);
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: normalizePrivateKey(parsed.private_key),
    };
  }

  return {
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: normalizePrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
  };
};

const serviceAccount = getServiceAccount();

const missingServiceAccountFields = [
  ["FIREBASE_ADMIN_PROJECT_ID", serviceAccount.projectId],
  ["FIREBASE_ADMIN_CLIENT_EMAIL", serviceAccount.clientEmail],
  ["FIREBASE_ADMIN_PRIVATE_KEY", serviceAccount.privateKey],
].filter(([, value]) => typeof value !== "string" || value.trim().length === 0);

if (missingServiceAccountFields.length > 0) {
  throw new Error(
    `Missing Firebase Admin environment variables: ${missingServiceAccountFields
      .map(([key]) => key)
      .join(", ")}`,
  );
}

const adminApp =
  getApps()[0] ??
  initializeApp({
    credential: cert({
      projectId: serviceAccount.projectId,
      clientEmail: serviceAccount.clientEmail,
      privateKey: serviceAccount.privateKey,
    }),
  });

const adminAuth = getAuth(adminApp);

const parseAdminEmails = () =>
  new Set(
    String(process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );

export const getRequestBody = (req) => {
  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body ?? {};
};

export const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return "";
  }

  return authHeader.slice("Bearer ".length).trim();
};

export const isAdminUser = (decodedToken) => {
  const adminEmails = parseAdminEmails();
  const email =
    typeof decodedToken.email === "string"
      ? decodedToken.email.trim().toLowerCase()
      : "";

  return (
    decodedToken.admin === true ||
    decodedToken.role === "admin" ||
    adminEmails.has(email)
  );
};

export const requireAdmin = async (req) => {
  const token = getBearerToken(req);

  if (!token) {
    const error = new Error("Missing bearer token.");
    error.statusCode = 401;
    throw error;
  }

  const decodedToken = await adminAuth.verifyIdToken(token);

  if (!isAdminUser(decodedToken)) {
    const error = new Error("Admin access required.");
    error.statusCode = 403;
    throw error;
  }

  return decodedToken;
};

export { adminAuth };
