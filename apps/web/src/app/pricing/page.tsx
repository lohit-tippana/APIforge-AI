import Link from "next/link";
import { Check, Zap } from "lucide-react";

const TIERS = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "For individual developers.",
    features: ["1 workspace", "3 projects", "Unlimited requests", "Collection runner", "Local AI engine", "Community support"],
    cta: "Get started",
    accent: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "per user / month",
    desc: "For power users who live in APIs.",
    features: ["Unlimited projects", "LLM-powered AI", "Unlimited test runs", "Request history sync", "Priority support"],
    cta: "Start Pro trial",
    accent: true,
  },
  {
    name: "Team",
    price: "$29",
    period: "per user / month",
    desc: "For engineering teams shipping together.",
    features: ["Everything in Pro", "Roles & permissions", "Activity feed & audit", "Shared environments", "SSO-ready", "Slack notifications"],
    cta: "Contact sales",
    accent: false,
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-accent-fg"><Zap size={13} strokeWidth={2.5} /></span>
          <span className="text-[14px] font-semibold tracking-tight">APIForge</span>
        </Link>
        <Link href="/login" className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] text-fg-muted hover:text-fg">Sign in</Link>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-16 text-center">
        <h1 className="text-[36px] font-semibold tracking-tight">Simple pricing</h1>
        <p className="mt-3 text-[14px] text-fg-muted">Start free. Upgrade when your team grows.</p>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {TIERS.map((t) => (
            <div key={t.name} className={`rounded-[var(--radius-md)] border p-6 text-left ${t.accent ? "border-accent/50 bg-accent-dim/40" : "border-border bg-surface-2"}`}>
              <h2 className="text-[15px] font-semibold">{t.name}</h2>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-[30px] font-semibold tracking-tight">{t.price}</span>
                <span className="text-[12px] text-fg-faint">{t.period}</span>
              </div>
              <p className="mt-1 text-[12.5px] text-fg-muted">{t.desc}</p>
              <ul className="mt-5 space-y-2">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[12.5px] text-fg-muted">
                    <Check size={13} className="shrink-0 text-success" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className={`mt-6 flex h-9 items-center justify-center rounded-[var(--radius-sm)] text-[13px] font-medium transition-colors ${t.accent ? "bg-accent text-accent-fg hover:bg-accent-strong" : "border border-border-strong text-fg hover:border-fg-faint"}`}
              >
                {t.cta}
              </Link>
            </div>
          ))}
        </div>

        <p className="mt-10 text-[12px] text-fg-faint">Prices in USD. No payment is collected in this demo build.</p>
      </section>
    </div>
  );
}
