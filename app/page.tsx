import IntakeForm from "../components/IntakeForm";
import RecentCases from "../components/RecentCases";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="text-3xl font-bold leading-tight tracking-tight text-accent-strong sm:text-4xl">
        Haq <span aria-hidden="true">·</span> হক <span aria-hidden="true">·</span> हक़
      </h1>
      <p className="mt-2 text-xl text-muted">Your right, in your language</p>
      <p className="mt-4 text-lg">
        Tell us about a problem with a government service. Haq finds the right office, writes your complaint and RTI
        application, checks its own work, and tells you when to follow up.
      </p>
      <div className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-6">
        <IntakeForm />
      </div>
      <RecentCases />
    </main>
  );
}