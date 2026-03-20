import { isAdminUser, requireAdmin } from "../_lib/firebaseAdmin.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    return;
  }

  try {
    const decodedToken = await requireAdmin(req);

    res.status(200).json({
      isAdmin: isAdminUser(decodedToken),
      email: decodedToken.email ?? null,
      uid: decodedToken.uid,
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      error: error instanceof Error ? error.message : "Failed to verify admin access.",
    });
  }
}
