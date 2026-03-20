// Normalize US phone numbers to E.164. Returns null if invalid.
export default function normalizePhoneE164(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = String(input).replace(/\D+/g, "");
  if (digits.length === 10) return `+1${digits}`; // assume US default
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.startsWith("+") && digits.length >= 11) return digits; // already looks e164-ish
  return null;
}