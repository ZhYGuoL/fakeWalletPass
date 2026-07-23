import { useEffect, useState } from "react";
import QRCode from "qrcode";

const PRODUCTION_SITE_URL = "https://keypass.zygl.dev";

function resolveSiteUrl() {
  const fromEnv = import.meta.env.VITE_SITE_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  if (import.meta.env.PROD) {
    return PRODUCTION_SITE_URL;
  }

  if (typeof window === "undefined") {
    return PRODUCTION_SITE_URL;
  }

  return window.location.origin;
}

function formatSiteLabel(url) {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function HeroQrCode() {
  const url = resolveSiteUrl();
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    if (!url) return undefined;

    let cancelled = false;

    QRCode.toDataURL(url, {
      width: 192,
      margin: 1,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    })
      .then((result) => {
        if (!cancelled) setDataUrl(result);
      })
      .catch(() => {
        if (!cancelled) setDataUrl("");
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!url || !dataUrl) {
    return null;
  }

  return (
    <aside className="hero__qr" aria-label={`QR code linking to ${url}`}>
      <p className="hero__qr-label">Scan to visit</p>
      <div className="hero__qr-frame">
        <img
          className="hero__qr-image"
          src={dataUrl}
          alt=""
          width={96}
          height={96}
          decoding="async"
        />
      </div>
      <p className="hero__qr-url">{formatSiteLabel(url)}</p>
    </aside>
  );
}
