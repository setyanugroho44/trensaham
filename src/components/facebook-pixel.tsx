import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSetting } from "@/lib/settings.functions";

const FB_PIXEL_KEY = "facebook_pixel_id";

type FbqFn = ((...args: unknown[]) => void) & {
  push: (...args: unknown[]) => void;
  loaded?: boolean;
  version?: string;
  queue?: unknown[];
  callMethod?: (...args: unknown[]) => void;
};

export function FacebookPixel() {
  const getSetting = useServerFn(getPublicSetting);
  const [pixelId, setPixelId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getSetting({ data: { key: FB_PIXEL_KEY } })
      .then((res) => {
        if (mounted) setPixelId(res.value ?? "");
      })
      .catch(() => {
        if (mounted) setPixelId("");
      });
    return () => {
      mounted = false;
    };
  }, [getSetting]);

  useEffect(() => {
    if (!pixelId || typeof window === "undefined") return;

    const w = window as typeof window & {
      fbq?: FbqFn;
      _fbq?: FbqFn;
    };
    if (w.fbq) return;

    const n: FbqFn = function (this: unknown, ...args: unknown[]) {
      if (n.callMethod) {
        n.callMethod.apply(this, args);
      } else {
        n.queue?.push(args);
      }
    } as FbqFn;

    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];

    w.fbq = n;

    const t = document.createElement("script");
    t.async = true;
    t.src = "https://connect.facebook.net/en_US/fbevents.js";
    const s = document.getElementsByTagName("script")[0];
    s.parentNode?.insertBefore(t, s);

    n("init", pixelId);
    n("track", "PageView");
  }, [pixelId]);

  if (!pixelId) return null;
  return (
    <noscript>
      <img
        height="1"
        width="1"
        style={{ display: "none" }}
        alt=""
        src={`https://www.facebook.com/tr?id=${pixelId}&ev=PageView&noscript=1`}
      />
    </noscript>
  );
}
