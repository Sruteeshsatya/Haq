import Link from "next/link";

/** Friendly "case not found" screen. Used by app/not-found.tsx and by the case page. */
export default function CaseNotFound() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold leading-tight text-accent-strong">We could not find this case.</h1>
      <p className="mt-3 text-lg text-muted">
        The link may be wrong, or the case was removed. Your cases are kept on the computer that runs Haq, so a link made
        on another computer will not open here.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-12 items-center rounded-xl bg-accent px-5 py-3 text-lg font-bold text-white"
      >
        Start a new case
      </Link>
    </main>
  );
}
