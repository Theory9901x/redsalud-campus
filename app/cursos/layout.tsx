import { SiteHeader } from "@/components/public/site-header";

export default function CursosLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-background">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(circle_at_15%_0%,rgba(43,166,222,0.18),transparent_55%),radial-gradient(circle_at_85%_10%,rgba(59,181,74,0.14),transparent_45%)]" />
      <div className="relative pb-20 pt-6">
        <SiteHeader />
        <main className="mx-auto mt-8 w-full max-w-5xl px-4">{children}</main>
      </div>
    </div>
  );
}
