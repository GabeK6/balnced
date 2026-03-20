"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RecurringPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/bills");
  }, [router]);

  return null;
}
