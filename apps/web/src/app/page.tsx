import { HealthCheck } from '@/components/health-check';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-8 px-6 py-16">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-[var(--muted)]">
          Take-home assignment
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Ready to build.
        </h1>
        <p className="text-[var(--muted)]">
          Next.js on the front, NestJS on the back, both behind nginx on{' '}
          <span className="font-mono">assignment.nikhiltayal.info</span>.
        </p>
      </div>

      <HealthCheck />
    </main>
  );
}
