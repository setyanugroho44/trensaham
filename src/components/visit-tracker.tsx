import { useEffect } from "react";
import { recordVisit } from "@/lib/web-analytics.functions";

const SEARCH_ENGINES: { domain: RegExp; name: string; params: string[] }[] = [
  { domain: /(^|\.)google\./, name: "Google", params: ["q", "query"] },
  { domain: /(^|\.)bing\.com$/, name: "Bing", params: ["q"] },
  { domain: /(^|\.)yahoo\./, name: "Yahoo", params: ["p", "q"] },
  { domain: /(^|\.)duckduckgo\.com$/, name: "DuckDuckGo", params: ["q"] },
  { domain: /(^|\.)yandex\./, name: "Yandex", params: ["text"] },
  { domain: /(^|\.)baidu\.com$/, name: "Baidu", params: ["wd", "word"] },
  { domain: /(^|\.)ecosia\.org$/, name: "Ecosia", params: ["q"] },
  { domain: /(^|\.)ask\.com$/, name: "Ask", params: ["q"] },
  { domain: /(^|\.)search\.brave\.com$/, name: "Brave", params: ["q"] },
];

/**
 * Records how a visitor arrived (search engine + keyword, or referring site).
 * Runs once per browser session, only for external / campaign entries.
 */
export function VisitTracker() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("visit_tracked") === "1") return;

      const currentHost = window.location.hostname;
      const url = new URL(window.location.href);
      const params = url.searchParams;

      const utm_source = params.get("utm_source");
      const utm_medium = params.get("utm_medium");
      const utm_campaign = params.get("utm_campaign");
      const utm_term = params.get("utm_term");
      const gclid = params.get("gclid");
      const fbclid = params.get("fbclid");

      const ref = document.referrer || "";
      let refUrl: URL | null = null;
      try {
        refUrl = ref ? new URL(ref) : null;
      } catch {
        refUrl = null;
      }

      const refHost = refUrl?.hostname ?? "";
      const isInternal = !!refHost && refHost === currentHost;
      const hasCampaign = !!(utm_source || utm_medium || utm_campaign || gclid || fbclid);
      const isExternalReferrer = !!refHost && !isInternal;

      // Only track meaningful acquisition entries: external referrers or campaigns.
      if (!isExternalReferrer && !hasCampaign) {
        sessionStorage.setItem("visit_tracked", "1");
        return;
      }

      let source_type: "search" | "referral" | "direct" = "direct";
      let search_engine: string | null = null;
      let search_keyword: string | null = utm_term || null;

      if (refHost) {
        const engine = SEARCH_ENGINES.find((e) => e.domain.test(refHost));
        if (engine) {
          source_type = "search";
          search_engine = engine.name;
          for (const p of engine.params) {
            const val = refUrl?.searchParams.get(p);
            if (val) {
              search_keyword = val;
              break;
            }
          }
        } else {
          source_type = "referral";
        }
      }

      if (source_type === "direct" && hasCampaign) {
        // Campaign click without a referrer host — treat paid/search campaigns as search.
        if (gclid || utm_medium === "cpc" || utm_medium === "paid") {
          source_type = "search";
          if (!search_engine) search_engine = gclid ? "Google Ads" : utm_source || "Campaign";
        } else {
          source_type = "referral";
        }
      }

      sessionStorage.setItem("visit_tracked", "1");

      void recordVisit({
        data: {
          source_type,
          referrer_url: ref ? ref.slice(0, 2000) : null,
          referrer_domain: refHost || null,
          search_engine,
          search_keyword: search_keyword ? search_keyword.slice(0, 500) : null,
          landing_path: url.pathname + url.search,
          utm_source,
          utm_medium,
          utm_campaign,
          utm_term,
          user_agent: navigator.userAgent.slice(0, 500),
        },
      }).catch(() => {
        /* best-effort tracking; ignore failures */
      });
    } catch {
      /* never break the page for tracking */
    }
  }, []);

  return null;
}
