import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getPublicSetting } from "@/lib/settings.functions";

const FB_PIXEL_KEY = "facebook_pixel_id";

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
      fbq?: (...args: unknown[]) => void;
      _fbq?: unknown;
    };
    if (w.fbq) return;

    const n = (w.fbq = function (this: unknown, ...args: unknown[]) {
      const fbqInstance = w.fbq as unknown as {
        callMethod?: (...args: unknown[]) => void;
        queue?: unknown[];
      };
      if (fbqInstance.callMethod) {
        fbqInstance.callMethod.apply(this, args);
      } else {
        fbqInstance.queue?.push(args);
      }
    });
    if (!w._fbq) w._fbq = n;
    const fbqInstance = w.fbq as unknown as {
      push: typeof n;
      loaded: boolean;
      version: string;
      queue: unknown[];
    };
    fbqInstance.push = n;
    fbqInstance.loaded = true;
    fbqInstance.version = "2.0";
    fbqInstance.queue = [];

    const t = document.createElement("script");
    t.async = true;
    t.src = "https://connect.facebook.net/en_US/fbevents.js";
    const s = document.getElementsByTagName("script")[0];
    s.parentNode?.insertBefore(t, s);

    fbqInstance("init", pixelId);
    fbqInstance("track", "PageView");
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
