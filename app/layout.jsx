import "./globals.css";
import Script from "next/script";

const TITLE = "Theia — pull IOCs from a threat intel report";
const DESC =
  "Paste a link to a threat intel report. Theia extracts every IOC, named threat, and vendor rule, each tied to the exact line that proves it. Deterministic, no model, no signup.";

export const metadata = {
  metadataBase: new URL("https://theia.ktlystlabs.com"),
  title: TITLE,
  description: DESC,
  keywords: [
    "IOC extractor", "indicators of compromise", "threat intelligence",
    "threat intel report", "CISA advisory", "MITRE ATT&CK", "Sigma rules",
    "detection engineering", "SOC", "deterministic", "no LLM",
  ],
  authors: [{ name: "KTLYST Labs" }],
  openGraph: {
    type: "website",
    url: "https://theia.ktlystlabs.com",
    siteName: "Theia",
    title: TITLE,
    description: DESC,
    images: [
      { url: "/og-image.png", width: 1200, height: 630, alt: "Theia — pull the IOCs out of a threat intel report" },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESC,
    images: ["/og-image.png"],
  },
  alternates: { canonical: "https://theia.ktlystlabs.com" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
      <Script id="posthog" strategy="afterInteractive">{`
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
        posthog.init('phc_UPtsFTILhptGbkcCd0hZElqnDMWJvmmmA5vbQeKXCFu',{api_host:'https://us.i.posthog.com',person_profiles:'identified_only'});
        posthog.register({app:'theia'});
      `}</Script>
    </html>
  );
}
