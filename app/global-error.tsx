"use client";

export default function GlobalError({ reset }: { reset: () => void }) {
  return (
    <html lang="en">
      <body className="bg-[#07090d] text-white">
        <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-5 text-center">
          <p className="font-mono text-[10px] tracking-[0.18em] text-red-200/45 uppercase">
            Signal interrupted
          </p>
          <h1 className="mt-3 text-4xl font-medium tracking-[-0.05em]">
            Something went wrong.
          </h1>
          <p className="mt-4 text-sm leading-6 text-white/45">
            The application hit an unexpected error. Your search is safe to
            retry.
          </p>
          <button
            type="button"
            onClick={reset}
            className="mt-7 rounded-full bg-blue-300 px-5 py-2.5 text-sm font-medium text-[#071226]"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
