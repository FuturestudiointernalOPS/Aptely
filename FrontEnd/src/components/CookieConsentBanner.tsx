"use client";

import CookieConsent from "react-cookie-consent";
import { getClientLocale, t } from "@/lib/i18n";

export function CookieConsentBanner() {
  const locale = getClientLocale();

  return (
    <CookieConsent
      location="bottom"
      buttonText={t(locale, "cookie.accept", "Accepter")}
      declineButtonText={t(locale, "cookie.decline", "Refuser")}
      enableDeclineButton
      cookieName="aptely_cookie_consent"
      style={{
        background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)",
        color: "var(--text-primary)",
        fontSize: "14px",
        alignItems: "center",
        padding: "16px 24px",
      }}
      buttonStyle={{
        background: "var(--accent)",
        color: "#fff",
        borderRadius: "8px",
        padding: "8px 20px",
        fontSize: "14px",
        fontWeight: "600",
        border: "none",
        cursor: "pointer",
      }}
      declineButtonStyle={{
        background: "transparent",
        color: "var(--text-secondary)",
        borderRadius: "8px",
        padding: "8px 20px",
        fontSize: "14px",
        border: "1px solid var(--border)",
        cursor: "pointer",
      }}
      expires={365}
    >
      {t(
        locale,
        "cookie.message",
        "Nous utilisons des cookies essentiels pour le fonctionnement de la plateforme. En continuant, vous acceptez leur utilisation conformément à notre"
      )}{" "}
      <a
        href="/privacy"
        style={{ color: "var(--accent)", textDecoration: "underline" }}
      >
        {t(locale, "cookie.privacyLink", "politique de confidentialité")}
      </a>
      .
    </CookieConsent>
  );
}
