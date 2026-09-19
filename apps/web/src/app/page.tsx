import Link from "next/link";
import { ArrowRight, FlaskConical, Globe, Lock, Search, Sparkles, Users, Zap } from "lucide-react";

const FEATURES = [
  { icon: Zap, title: "Fast request builder", desc: "Params, auth, headers, body and tests in one dense, keyboard-first workspace." },
  { icon: FlaskConical, title: "Real API testing", desc: "Assertions on status, timing, JSON paths, headers and schemas — run whole collections." },
  { icon: Sparkles, title: "AI assistance", desc: "Generate requests from plain English, generate tests from responses, explain errors." },
  { icon: Globe, title: "Environments", desc: "Dev / staging / prod variables with {{interpolation}} and server-side secrets." },
  { icon: Users, title: "Team workspaces", desc: "Roles, invites, activity feed and shared projects for your whole team." },
  { icon: Search, title: "Command palette", desc: "⌘K to jump between requests, projects and actions without touching the mouse." },
];

const CODE = `<span class="text-[#c084fc]">POST</span> <span class="text-fg-muted">{{BASE_URL}}</span><span class="text-fg">/auth/login</span>

<span class="text-[#8ab4f8]">{
  "username": "emilys",
  "password": "••••••••"
}</span>

<span class="text-fg-faint">→ 200 OK · 241ms</span>
<span class="text-[#98c379]">{ "accessToken": "eyJhbG…", "id": 15 }</span>`;

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      {/* Nav */}
      <header className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-accent-fg"><Zap size={13} strokeWidth={2.5} /></span>
          <span className="text-[14px] font-semibold tracking-tight">APIForge</span>
        </div>
        <nav className="hidden items-center gap-6 text-[13px] text-fg-muted md:flex">
          <a href="#features" className="hover:text-fg transition-colors">Features</a>
          <a href="#ai" className="hover:text-fg transition-colors">AI</a>
          <Link href="/pricing" className="hover:text-fg transition-colors">Pricing</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="rounded-[var(--radius-sm)] px-3 py-1.5 text-[13px] text-fg-muted hover:text-fg transition-colors">Sign in</Link>
          <Link href="/register" className="rounded-[var(--radius-sm)] bg-accent px-3.5 py-1.5 text-[13px] font-medium text-accent-fg hover:bg-accent-strong transition-colors">Get started</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <div className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-[11.5px] text-fg-muted">
          <Sparkles size={11} className="text-accent" /> AI-native API workspace
        </div>
        <h1 className="mx-auto max-w-3xl text-[42px] font-semibold leading-[1.1] tracking-tight md:text-[56px]">
          Build, test &amp; understand APIs <span className="text-accent">faster.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-fg-muted">
          An intelligent API workspace for modern engineering teams — design requests, run assertions, generate docs and debug failures with AI.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/register" className="flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-accent px-5 text-[14px] font-medium text-accent-fg hover:bg-accent-strong transition-colors">
            Start building <ArrowRight size={15} />
          </Link>
          <Link href="/login" className="flex h-10 items-center rounded-[var(--radius-sm)] border border-border-strong px-5 text-[14px] text-fg-muted hover:border-fg-faint hover:text-fg transition-colors">
            Live demo
          </Link>
        </div>

        {/* Product preview */}
        <div className="mx-auto mt-16 max-w-4xl overflow-hidden rounded-[var(--radius-md)] border border-border-strong bg-surface shadow-[var(--shadow-pop)]">
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#3a3f48]" /><span className="h-2.5 w-2.5 rounded-full bg-[#3a3f48]" /><span className="h-2.5 w-2.5 rounded-full bg-[#3a3f48]" />
            <span className="ml-3 flex-1 text-center font-mono text-[10.5px] text-fg-faint">apiforge — E-Commerce API / Authentication</span>
          </div>
          <div className="grid grid-cols-[180px_1fr] text-left">
            <div className="border-r border-border p-3 text-[11.5px] leading-6 text-fg-muted">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-faint">Authentication</p>
              <p><span className="mr-1.5 font-mono text-[10px] font-semibold text-method-post">POST</span>Login</p>
              <p><span className="mr-1.5 font-mono text-[10px] font-semibold text-method-get">GET</span>Get current user</p>
              <p className="mt-3 text-[10px] font-semibold uppercase tracking-wider text-fg-faint">Products</p>
              <p><span className="mr-1.5 font-mono text-[10px] font-semibold text-method-get">GET</span>List products</p>
              <p><span className="mr-1.5 font-mono text-[10px] font-semibold text-method-post">POST</span>Create product</p>
            </div>
            <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-[1.8]" dangerouslySetInnerHTML={{ __html: CODE }} />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-[28px] font-semibold tracking-tight">Everything an API workflow needs</h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-[14px] text-fg-muted">Not a mockup — every feature is wired to a real backend.</p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-5 transition-colors hover:border-border-strong">
                <f.icon size={17} className="text-accent" />
                <h3 className="mt-3 text-[14px] font-semibold">{f.title}</h3>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-fg-muted">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI section */}
      <section id="ai" className="border-t border-border">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-20 md:grid-cols-2">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-[11px] text-accent"><Sparkles size={11} /> AI-powered</div>
            <h2 className="text-[26px] font-semibold tracking-tight">Debug and generate with AI</h2>
            <ul className="mt-5 space-y-3 text-[13.5px] text-fg-muted">
              <li className="flex gap-2.5"><Lock size={15} className="mt-0.5 shrink-0 text-accent" /><span><strong className="text-fg">Explain errors</strong> — 401s, CORS, timeouts diagnosed from your actual request and response.</span></li>
              <li className="flex gap-2.5"><FlaskConical size={15} className="mt-0.5 shrink-0 text-accent" /><span><strong className="text-fg">Generate tests</strong> — assertions inferred from the real response shape.</span></li>
              <li className="flex gap-2.5"><Zap size={15} className="mt-0.5 shrink-0 text-accent" /><span><strong className="text-fg">Generate requests</strong> — describe the endpoint in English, get a configured request.</span></li>
            </ul>
          </div>
          <div className="rounded-[var(--radius-md)] border border-border bg-surface-2 p-4 font-mono text-[12px] leading-relaxed">
            <p className="text-fg-faint">$ Why am I getting a 401?</p>
            <p className="mt-3 text-fg"><span className="text-accent">◆</span> The request is configured with <strong>No Auth</strong>.</p>
            <p className="mt-1 text-fg-muted">Add a Bearer token in the Authorization tab — the API sent <code className="text-[#8ab4f8]">WWW-Authenticate: Bearer</code>.</p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-surface/50">
        <div className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-[26px] font-semibold tracking-tight">Start forging better APIs</h2>
          <p className="mt-2 text-[14px] text-fg-muted">Free for individuals. No credit card.</p>
          <Link href="/register" className="mt-6 inline-flex h-10 items-center gap-2 rounded-[var(--radius-sm)] bg-accent px-6 text-[14px] font-medium text-accent-fg hover:bg-accent-strong transition-colors">
            Get started <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-[12px] text-fg-faint sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-accent text-accent-fg"><Zap size={10} strokeWidth={2.5} /></span>
            APIForge AI
          </div>
          <div className="flex gap-5">
            <Link href="/pricing" className="hover:text-fg-muted">Pricing</Link>
            <Link href="/login" className="hover:text-fg-muted">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
