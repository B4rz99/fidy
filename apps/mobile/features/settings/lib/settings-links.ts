const LANDING_BASE = "https://fidy-landing.vercel.app";

export const buildPrivacyUrl = (locale: string): string => `${LANDING_BASE}/${locale}/privacy`;

export const buildTermsUrl = (locale: string): string => `${LANDING_BASE}/${locale}/terms`;

export const buildWhatsAppUrl = (phone: string): string => `https://wa.me/${phone}`;

export const getUserInitials = (
  name: string | undefined | null,
  email: string,
): string => {
  if (!name) {
    return email.charAt(0).toUpperCase();
  }
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
};
