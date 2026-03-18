const LANDING_BASE = "https://fidy-landing.vercel.app";

export const buildPrivacyUrl = (locale: string): string => `${LANDING_BASE}/${locale}/privacy`;

export const buildTermsUrl = (locale: string): string => `${LANDING_BASE}/${locale}/terms`;

export const buildWhatsAppUrl = (phone: string): string => `https://wa.me/${phone}`;

export const getUserInitials = (name: string | undefined | null, email: string): string => {
  const trimmed = name?.trim();
  if (!trimmed) {
    return email.charAt(0).toUpperCase();
  }
  const parts = trimmed.split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
};
