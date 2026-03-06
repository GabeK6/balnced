export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      <p className="mt-2 text-gray-600">
        Welcome to Balnced. This is your money overview.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border p-6">
          <h2 className="text-sm text-gray-500">Safe to Spend</h2>
          <p className="mt-2 text-3xl font-bold">$0.00</p>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-sm text-gray-500">Current Balance</h2>
          <p className="mt-2 text-3xl font-bold">$0.00</p>
        </div>

        <div className="rounded-2xl border p-6">
          <h2 className="text-sm text-gray-500">Bills Before Payday</h2>
          <p className="mt-2 text-3xl font-bold">$0.00</p>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border p-6">
        <h2 className="text-xl font-semibold">Next step</h2>
        <p className="mt-2 text-gray-600">
          Next we’ll build your onboarding form so users can enter their
          balance, paycheck, and bills.
        </p>
      </div>
    </main>
  );
}