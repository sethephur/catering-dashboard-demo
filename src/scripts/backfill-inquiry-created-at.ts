import { initializeApp } from "firebase/app";
import {
  Timestamp,
  collection,
  getDocs,
  getFirestore,
  writeBatch,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const loadEnvFileEntries = () => {
  const candidates = [".env.local", ".env"];
  const parsed = new Map<string, string>();

  for (const file of candidates) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    const raw = readFileSync(path, "utf8");
    raw.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (!parsed.has(key)) {
        parsed.set(key, value.replace(/^['"]|['"]$/g, ""));
      }
    });
  }

  return parsed;
};

const envFileEntries = loadEnvFileEntries();
const readEnv = (name: string) => process.env[name] || envFileEntries.get(name) || "";

const firebaseConfig = {
  apiKey: readEnv("VITE_FIREBASE_API_KEY"),
  authDomain: readEnv("VITE_FIREBASE_AUTH_DOMAIN"),
  projectId: readEnv("VITE_FIREBASE_PROJECT_ID"),
  storageBucket: readEnv("VITE_FIREBASE_STORAGE_BUCKET"),
  messagingSenderId: readEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
  appId: readEnv("VITE_FIREBASE_APP_ID"),
  measurementId: readEnv("VITE_FIREBASE_MEASUREMENT_ID"),
};

const missingFirebaseEnv = Object.entries(firebaseConfig)
  .filter(([key, value]) => key !== "measurementId" && (!value || value.trim().length === 0))
  .map(([key]) => key);

if (missingFirebaseEnv.length > 0) {
  throw new Error(
    `Missing Firebase configuration for backfill script: ${missingFirebaseEnv.join(", ")}`,
  );
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const args = new Set(process.argv.slice(2));
const shouldWrite = args.has("--write");
const limitArg = [...args].find((arg) => arg.startsWith("--limit="));
const writeLimit = limitArg ? Number(limitArg.split("=")[1]) : null;
const MIN_REASONABLE_MS = Date.UTC(2000, 0, 1);
const MAX_REASONABLE_MS = Date.now() + 1000 * 60 * 60 * 24;

const toMillis = (value: unknown): number => {
  try {
    if (!value) return 0;
    if (
      typeof value === "object" &&
      value != null &&
      "toDate" in value &&
      typeof (value as { toDate?: () => Date }).toDate === "function"
    ) {
      return (value as { toDate: () => Date }).toDate().getTime();
    }
    if (typeof value === "object" && value != null && "seconds" in value) {
      const seconds = (value as { seconds?: unknown }).seconds;
      if (typeof seconds === "number") return seconds * 1000;
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return value > 1_000_000_000_000 ? value : value * 1000;
    }
    if (typeof value === "string") {
      const direct = Date.parse(value);
      if (!Number.isNaN(direct)) return direct;
      const normalized = value
        .replace(/\sat\s/i, " ")
        .replace(/\u202F/g, " ")
        .replace(/UTC/g, "GMT");
      const fallback = Date.parse(normalized);
      if (!Number.isNaN(fallback)) return fallback;
    }
  } catch {
    return 0;
  }
  return 0;
};

const hasFirestoreTimestamp = (value: unknown) =>
  Boolean(
    value &&
      typeof value === "object" &&
      "toDate" in value &&
      typeof (value as { toDate?: () => Date }).toDate === "function",
  );

const resolveCreatedAtMillis = (data: DocumentData): number => {
  if (hasFirestoreTimestamp(data.createdAt)) {
    return 0;
  }

  return (
    toMillis(data.created_at) ||
    toMillis(data.dateCreated) ||
    toMillis(data.createdAt)
  );
};

const isReasonableCreatedAt = (ms: number) =>
  ms >= MIN_REASONABLE_MS && ms <= MAX_REASONABLE_MS;

const chunk = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

async function main() {
  const snapshot = await getDocs(collection(db, "eventInquiries"));

  let total = 0;
  let skipped = 0;
  let invalid = 0;

  const updates: Array<{
    doc: QueryDocumentSnapshot<DocumentData>;
    createdAt: Timestamp;
  }> = [];
  const suspicious: Array<{ docId: string; rawValue: unknown; parsedMs: number }> =
    [];

  snapshot.docs.forEach((doc) => {
    total += 1;
    const data = doc.data();

    if (hasFirestoreTimestamp(data.createdAt)) {
      skipped += 1;
      return;
    }

    const ms = resolveCreatedAtMillis(data);
    if (!ms) {
      invalid += 1;
      return;
    }

    if (!isReasonableCreatedAt(ms)) {
      suspicious.push({
        docId: doc.id,
        rawValue: data.dateCreated ?? data.created_at ?? data.createdAt,
        parsedMs: ms,
      });
      invalid += 1;
      return;
    }

    updates.push({
      doc,
      createdAt: Timestamp.fromMillis(ms),
    });
  });

  console.log(`Scanned ${total} inquiry documents.`);
  console.log(`Already normalized: ${skipped}`);
  console.log(`Needs update: ${updates.length}`);
  console.log(`Could not parse: ${invalid}`);

  if (suspicious.length > 0) {
    console.log("");
    console.log("Skipped suspicious values:");
    suspicious.slice(0, 10).forEach(({ docId, rawValue, parsedMs }) => {
      console.log(
        `- ${docId} -> raw=${JSON.stringify(rawValue)} parsed=${new Date(parsedMs).toISOString()}`,
      );
    });
  }

  if (updates.length > 0) {
    console.log("Sample updates:");
    updates.slice(0, 10).forEach(({ doc, createdAt }) => {
      console.log(`- ${doc.id} -> ${createdAt.toDate().toISOString()}`);
    });
  }

  if (!shouldWrite) {
    console.log("");
    console.log("Dry run only. Re-run with --write to apply updates.");
    return;
  }

  const updatesToApply =
    typeof writeLimit === "number" && Number.isFinite(writeLimit) && writeLimit > 0
      ? updates.slice(0, writeLimit)
      : updates;

  console.log("");
  console.log(
    `Applying ${updatesToApply.length} updates${writeLimit ? ` (limited by --limit=${writeLimit})` : ""}.`,
  );

  for (const batchItems of chunk(updatesToApply, 400)) {
    const batch = writeBatch(db);
    batchItems.forEach(({ doc, createdAt }) => {
      batch.update(doc.ref, { createdAt });
    });
    await batch.commit();
  }

  console.log("");
  console.log(`Applied ${updatesToApply.length} createdAt backfill updates.`);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exitCode = 1;
});
