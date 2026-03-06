export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-black">
      <section className="mx-auto flex max-w-5xl flex-col items-center px-6 py-24 text-center">
        <h1 className="text-5xl font-bold tracking-tight">
          Know exactly what you can spend before payday.
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-gray-600">
          Balnced helps you plan bills, track spending, and stay ahead with
          simple AI insights.
        </p>

        <div className="mt-8 flex gap-4">
          <a
            href="/signup"
            className="rounded-xl bg-black px-6 py-3 text-white"
          >
            Get Started
          </a>

          <a
            href="/login"
            className="rounded-xl border border-gray-300 px-6 py-3"
          >
            Log In
          </a>
        </div>
      </section>
    </main>
  );
}