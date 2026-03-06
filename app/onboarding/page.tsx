"use client";

import { supabase } from "@/lib/supabase";

import { useState } from "react";

export default function OnboardingPage() {
  const [balance, setBalance] = useState("");
  const [paycheck, setPaycheck] = useState("");
  const [payday, setPayday] = useState("");

async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    alert("You must be logged in.");
    return;
  }

  const { error } = await supabase.from("budgets").insert({
    user_id: user.id,
    balance: Number(balance),
    paycheck: Number(paycheck),
    next_payday: payday,
  });

  if (error) {
    console.error(error);
    alert("Error saving budget");
    return;
  }

  alert("Budget saved!");

  window.location.href = "/dashboard";
}

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-bold">Set up your budget</h1>
      <p className="mt-2 text-gray-600">
        Enter your financial basics so Balnced can calculate your safe-to-spend.
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-4">
        <div>
          <label className="block text-sm font-medium">Current Balance</label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="w-full rounded-xl border p-3"
            placeholder="1000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Paycheck Amount</label>
          <input
            type="number"
            value={paycheck}
            onChange={(e) => setPaycheck(e.target.value)}
            className="w-full rounded-xl border p-3"
            placeholder="1500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Next Payday</label>
          <input
            type="date"
            value={payday}
            onChange={(e) => setPayday(e.target.value)}
            className="w-full rounded-xl border p-3"
          />
        </div>

        <button className="w-full rounded-xl bg-black p-3 text-white">
          Save Budget
        </button>
      </form>
    </main>
  );
}