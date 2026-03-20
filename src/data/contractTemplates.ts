import type { Firestore } from "firebase/firestore";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { FirebaseStorage } from "firebase/storage";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import type { ContractType } from "@/utils/helpers/helpers";

export type ContractTemplateOverride = {
  id: string;
  contractType: ContractType;
  downloadUrl: string;
  storagePath: string;
  fileName: string;
  uploadedAtLabel: string | null;
};

const COLLECTION_NAME = "contractTemplates";

const toUploadedAtLabel = (value: unknown) => {
  if (
    typeof value === "object" &&
    value != null &&
    "toDate" in value &&
    typeof (value as { toDate?: () => Date }).toDate === "function"
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  }
  return null;
};

const parseRow = (
  id: string,
  row: Record<string, unknown>,
): ContractTemplateOverride | null => {
  if (
    typeof row.contractType !== "string" ||
    typeof row.downloadUrl !== "string" ||
    typeof row.storagePath !== "string" ||
    typeof row.fileName !== "string"
  ) {
    return null;
  }

  return {
    id,
    contractType: row.contractType as ContractType,
    downloadUrl: row.downloadUrl,
    storagePath: row.storagePath,
    fileName: row.fileName,
    uploadedAtLabel: toUploadedAtLabel(row.updatedAt),
  };
};

export function subscribeContractTemplateOverrides(
  db: Firestore,
  opts: {
    onData: (rows: ContractTemplateOverride[]) => void;
    onError?: (err: unknown) => void;
  },
) {
  if (DEMO_MODE_ENABLED) {
    opts.onData([]);
    return () => undefined;
  }

  const base = collection(db, COLLECTION_NAME);
  return onSnapshot(
    query(base),
    (snap) => {
      const rows = snap.docs
        .map((item) => parseRow(item.id, item.data() as Record<string, unknown>))
        .filter((value): value is ContractTemplateOverride => value != null)
        .sort((a, b) => a.contractType.localeCompare(b.contractType));
      opts.onData(rows);
    },
    (err) => opts.onError?.(err),
  );
}

export async function getContractTemplateOverride(
  db: Firestore,
  contractType: ContractType,
) {
  if (DEMO_MODE_ENABLED) return null;

  const snap = await getDoc(doc(db, COLLECTION_NAME, contractType));
  if (!snap.exists()) return null;
  return parseRow(
    snap.id,
    snap.data() as Record<string, unknown>,
  );
}

export async function uploadContractTemplateOverride(opts: {
  db: Firestore;
  storage: FirebaseStorage;
  contractType: ContractType;
  file: File;
}) {
  if (DEMO_MODE_ENABLED) {
    throw new Error("Contract uploads are disabled in demo mode.");
  }

  const safeFileName = opts.file.name.replace(/\s+/g, "-");
  const storagePath = `contractTemplates/${opts.contractType}/${Date.now()}-${safeFileName}`;
  const storageRef = ref(opts.storage, storagePath);
  await uploadBytes(storageRef, opts.file, {
    contentType:
      opts.file.type ||
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
  const downloadUrl = await getDownloadURL(storageRef);

  await setDoc(doc(opts.db, COLLECTION_NAME, opts.contractType), {
    contractType: opts.contractType,
    fileName: opts.file.name,
    storagePath,
    downloadUrl,
    updatedAt: serverTimestamp(),
  });
}
