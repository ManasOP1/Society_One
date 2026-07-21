"use client";

import { Suspense } from "react";
import PublicInvoicePage from "./public-invoice-client";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#F5F7FB]">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4F46E5] border-t-transparent" />
        </div>
      }
    >
      <PublicInvoicePage />
    </Suspense>
  );
}
