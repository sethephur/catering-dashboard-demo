import {
  createEmailTemplate,
  deleteEmailTemplate,
  EmailTemplate,
  subscribeEmailTemplates,
  updateEmailTemplate,
} from "@/data/emailTemplates";
import { buildDefaultSavedEmailTemplates } from "@/utils/helpers/helpers";
import type { Firestore } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";

const parseErr = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function useEmailTemplates(db: Firestore) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seedingDefaults, setSeedingDefaults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seededRef = useRef(false);

  useEffect(() => {
    const unsub = subscribeEmailTemplates(db, {
      onData: (rows) => {
        setTemplates(rows);
        setLoading(false);
      },
      onError: (e) => {
        setError(parseErr(e));
        setLoading(false);
      },
    });
    return () => unsub();
  }, [db]);

  useEffect(() => {
    if (loading || error || seededRef.current) return;

    const hasSystemTemplate = templates.some(
      (template) =>
        typeof template.systemKey === "string" && template.systemKey.trim() !== "",
    );
    if (hasSystemTemplate) {
      seededRef.current = true;
      return;
    }

    const defaults = buildDefaultSavedEmailTemplates();
    if (defaults.length === 0) {
      seededRef.current = true;
      return;
    }

    seededRef.current = true;
    setSeedingDefaults(true);
    Promise.all(
      defaults.map((template) =>
        createEmailTemplate(db, {
          name: template.name,
          body: template.body,
          systemKey: template.systemKey,
        }),
      ),
    )
      .catch((e) => {
        setError(parseErr(e));
        seededRef.current = false;
      })
      .finally(() => {
        setSeedingDefaults(false);
      });
  }, [db, error, loading, templates]);

  const create = async (payload: { name: string; body: string }) =>
    createEmailTemplate(db, payload);

  const update = async (
    id: string,
    patch: { name?: string; body?: string },
  ) => updateEmailTemplate(db, id, patch);

  const remove = async (id: string) => deleteEmailTemplate(db, id);

  return { templates, loading: loading || seedingDefaults, error, create, update, remove };
}
