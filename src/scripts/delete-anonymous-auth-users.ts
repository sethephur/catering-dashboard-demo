import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type UserRecord } from "firebase-admin/auth";

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const serviceAccountArg = [...args].find((arg) =>
  arg.startsWith("--service-account="),
);

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const sleep = (ms: number) =>
  new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const loadServiceAccount = () => {
  if (!serviceAccountArg) {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
      /\\n/g,
      "\n",
    );

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        "Missing admin credentials. Provide --service-account=/absolute/path/to/service-account.json or set FIREBASE_ADMIN_PROJECT_ID, FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY.",
      );
    }

    return { projectId, clientEmail, privateKey };
  }

  const serviceAccountPath = resolve(serviceAccountArg.split("=")[1]);
  const raw = readFileSync(serviceAccountPath, "utf8");
  const parsed = JSON.parse(raw) as {
    project_id?: string;
    client_email?: string;
    private_key?: string;
  };

  if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
    throw new Error(
      "The service account JSON is missing project_id, client_email, or private_key.",
    );
  }

  return {
    projectId: parsed.project_id,
    clientEmail: parsed.client_email,
    privateKey: parsed.private_key,
  };
};

const isAnonymousUser = (userRecord: UserRecord) => {
  if (userRecord.providerData.some((provider) => provider.providerId === "anonymous")) {
    return true;
  }

  return (
    !userRecord.email &&
    !userRecord.phoneNumber &&
    userRecord.providerData.length === 0
  );
};

async function main() {
  const serviceAccount = loadServiceAccount();

  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert({
        projectId: serviceAccount.projectId,
        clientEmail: serviceAccount.clientEmail,
        privateKey: serviceAccount.privateKey,
      }),
    });

  const adminAuth = getAuth(app);
  const candidates: UserRecord[] = [];

  let pageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    page.users.forEach((userRecord) => {
      if (isAnonymousUser(userRecord)) {
        candidates.push(userRecord);
      }
    });
    pageToken = page.pageToken;
  } while (pageToken);

  console.log(`Found ${candidates.length} anonymous auth user(s).`);

  if (candidates.length > 0) {
    console.log("Sample:");
    candidates.slice(0, 10).forEach((userRecord) => {
      console.log(
        `- uid=${userRecord.uid} created=${userRecord.metadata.creationTime ?? "unknown"} lastSignIn=${userRecord.metadata.lastSignInTime ?? "never"}`,
      );
    });
  }

  if (!shouldWrite) {
    console.log("");
    console.log("Dry run only. Re-run with --write to delete these users.");
    return;
  }

  let deletedCount = 0;

  for (const batch of chunk(
    candidates.map((userRecord) => userRecord.uid),
    1000,
  )) {
    const result = await adminAuth.deleteUsers(batch);
    deletedCount += result.successCount;

    if (result.failureCount > 0) {
      console.log("");
      console.log(`Batch had ${result.failureCount} deletion failure(s):`);
      result.errors.forEach((error) => {
        console.log(`- index=${error.index} reason=${error.error.toString()}`);
      });
    }

    if (batch.length === 1000) {
      await sleep(1100);
    }
  }

  console.log("");
  console.log(`Deleted ${deletedCount} anonymous auth user(s).`);
}

main().catch((error) => {
  console.error("Anonymous auth cleanup failed:", error);
  process.exitCode = 1;
});
