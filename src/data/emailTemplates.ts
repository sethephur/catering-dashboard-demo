import type { Firestore } from "firebase/firestore";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { DEMO_MODE_ENABLED } from "@/config/appInfo";
import { buildDefaultSavedEmailTemplates } from "@/utils/helpers/helpers";

export type EmailTemplate = {
  id: string;
  name: string;
  body: string;
  systemKey: string | null;
};

export type Unsub = () => void;

const COLLECTION_NAME = "emailTemplates";
const demoTemplateListeners = new Set<(templates: EmailTemplate[]) => void>();

let demoTemplates: EmailTemplate[] = buildDefaultSavedEmailTemplates().map(
  (template, index) => ({
    id: `demo-template-${template.systemKey ?? index + 1}`,
    name: template.name,
    body: template.body,
    systemKey: template.systemKey,
  }),
);

const emitDemoTemplates = () => {
  const snapshot = [...demoTemplates].sort((a, b) => a.name.localeCompare(b.name));
  demoTemplateListeners.forEach((listener) => listener(snapshot));
};

const normalizeText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const parseTemplateRow = (id: string, data: Record<string, unknown>): EmailTemplate => ({
  id,
  name: normalizeText(data.name) || "Untitled template",
  body: typeof data.body === "string" ? data.body : "",
  systemKey: typeof data.systemKey === "string" ? data.systemKey : null,
});

/**
 * Subscribes to top-level `emailTemplates`.
 * Falls back to client-side sorting if `orderBy("name")` is unavailable.
 */
export function subscribeEmailTemplates(
  db: Firestore,
  opts: {
    onData: (templates: EmailTemplate[]) => void;
    onError?: (err: unknown) => void;
  },
): Unsub {
  if (DEMO_MODE_ENABLED) {
    const listener = (templates: EmailTemplate[]) => opts.onData(templates);
    listener([...demoTemplates].sort((a, b) => a.name.localeCompare(b.name)));
    demoTemplateListeners.add(listener);
    return () => {
      demoTemplateListeners.delete(listener);
    };
  }

  const base = collection(db, COLLECTION_NAME);

  let activeUnsub: Unsub | null = null;
  let usedFallback = false;

  const attach = (useFallback: boolean) => {
    const q = useFallback ? query(base) : query(base, orderBy("name", "asc"));

    return onSnapshot(
      q,
      (snap) => {
        const rows = snap.docs.map((d) =>
          parseTemplateRow(d.id, d.data() as Record<string, unknown>),
        );
        rows.sort((a, b) => a.name.localeCompare(b.name));
        opts.onData(rows);
      },
      (err: unknown) => {
        if (
          typeof err === "object" &&
          err != null &&
          "code" in err &&
          (err as { code?: string }).code === "failed-precondition" &&
          !usedFallback
        ) {
          usedFallback = true;
          if (activeUnsub) {
            activeUnsub();
            activeUnsub = null;
          }
          activeUnsub = attach(true);
          return;
        }
        opts.onError?.(err);
      },
    );
  };

  activeUnsub = attach(false);

  return () => {
    if (activeUnsub) activeUnsub();
  };
}

export async function createEmailTemplate(
  db: Firestore,
  payload: { name: string; body: string; systemKey?: string },
) {
  if (DEMO_MODE_ENABLED) {
    const id = `demo-template-custom-${Date.now()}`;
    demoTemplates = [
      {
        id,
        name: payload.name.trim(),
        body: payload.body,
        systemKey: payload.systemKey ?? null,
      },
      ...demoTemplates,
    ];
    emitDemoTemplates();
    return id;
  }

  const ref = collection(db, COLLECTION_NAME);
  const docRef = await addDoc(ref, {
    name: payload.name.trim(),
    body: payload.body,
    systemKey: payload.systemKey ?? null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateEmailTemplate(
  db: Firestore,
  id: string,
  patch: { name?: string; body?: string },
) {
  if (DEMO_MODE_ENABLED) {
    demoTemplates = demoTemplates.map((template) =>
      template.id === id
        ? {
            ...template,
            name:
              typeof patch.name === "string" ? patch.name.trim() : template.name,
            body: typeof patch.body === "string" ? patch.body : template.body,
          }
        : template,
    );
    emitDemoTemplates();
    return;
  }

  const ref = doc(db, COLLECTION_NAME, id);
  const updatePayload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (typeof patch.name === "string") updatePayload.name = patch.name.trim();
  if (typeof patch.body === "string") updatePayload.body = patch.body;
  await updateDoc(ref, updatePayload);
}

export async function deleteEmailTemplate(db: Firestore, id: string) {
  if (DEMO_MODE_ENABLED) {
    demoTemplates = demoTemplates.filter((template) => template.id !== id);
    emitDemoTemplates();
    return;
  }

  const ref = doc(db, COLLECTION_NAME, id);
  await deleteDoc(ref);
}
