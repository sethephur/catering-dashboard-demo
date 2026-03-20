import { adminAuth, getRequestBody, requireAdmin } from "../_lib/firebaseAdmin.js";

const isValidPassword = (value) =>
  typeof value === "string" && value.trim().length >= 8;

const formatUserRecord = (userRecord) => ({
  uid: userRecord.uid,
  email: userRecord.email ?? "",
  displayName: userRecord.displayName ?? null,
  isAdmin: userRecord.customClaims?.admin === true,
  disabled: userRecord.disabled === true,
  creationTime: userRecord.metadata.creationTime ?? null,
  lastSignInTime: userRecord.metadata.lastSignInTime ?? null,
});

export default async function handler(req, res) {
  try {
    await requireAdmin(req);

    if (req.method === "GET") {
      const listUsersResult = await adminAuth.listUsers(1000);

      res.status(200).json({
        users: listUsersResult.users
          .filter((userRecord) => Boolean(userRecord.email))
          .map(formatUserRecord),
      });
      return;
    }

    if (req.method === "PATCH") {
      const body = getRequestBody(req);
      const uid = typeof body.uid === "string" ? body.uid.trim() : "";

      if (!uid) {
        res.status(400).json({ error: "User uid is required." });
        return;
      }

      const displayName =
        typeof body.displayName === "string" ? body.displayName.trim() : "";

      const userRecord = await adminAuth.updateUser(uid, {
        displayName: displayName || null,
      });

      res.status(200).json({
        user: formatUserRecord(userRecord),
      });
      return;
    }

    if (req.method === "DELETE") {
      const body = getRequestBody(req);
      const uid = typeof body.uid === "string" ? body.uid.trim() : "";

      if (!uid) {
        res.status(400).json({ error: "User uid is required." });
        return;
      }

      await adminAuth.deleteUser(uid);
      res.status(200).json({ success: true, uid });
      return;
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", ["GET", "PATCH", "DELETE", "POST"]);
      res.status(405).json({ error: `Method ${req.method} Not Allowed` });
      return;
    }

    const body = getRequestBody(req);
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password =
      typeof body.password === "string" ? body.password.trim() : "";
    const displayName =
      typeof body.displayName === "string" && body.displayName.trim().length > 0
        ? body.displayName.trim()
        : undefined;
    const makeAdmin = body.isAdmin === true;

    if (!email) {
      res.status(400).json({ error: "Email is required." });
      return;
    }

    if (!isValidPassword(password)) {
      res.status(400).json({
        error: "Temporary password must be at least 8 characters.",
      });
      return;
    }

    const userRecord = await adminAuth.createUser({
      email,
      password,
      displayName,
    });

    if (makeAdmin) {
      await adminAuth.setCustomUserClaims(userRecord.uid, { admin: true });
    }

    const refreshedUserRecord = makeAdmin
      ? await adminAuth.getUser(userRecord.uid)
      : userRecord;

    res.status(201).json(formatUserRecord(refreshedUserRecord));
  } catch (error) {
    const code =
      typeof error === "object" &&
      error != null &&
      "code" in error &&
      typeof error.code === "string"
        ? error.code
        : "";

    const statusCode =
      typeof error === "object" &&
      error != null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    if (code === "auth/email-already-exists") {
      res.status(409).json({ error: "A user with that email already exists." });
      return;
    }

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to create user.",
    });
  }
}
