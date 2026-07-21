"use client";

import Link from "next/link";
import { PageTransition } from "@/components/shared/page-transition";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Complaints module hidden from nav — route kept for later. */
export default function ComplaintsHiddenPage() {
  return (
    <PageTransition>
      <Card className="mx-auto max-w-lg">
        <CardContent className="space-y-4 p-8 text-center">
          <h1 className="text-xl font-bold">Complaints paused</h1>
          <p className="text-sm text-muted-foreground">
            This module is temporarily hidden while billing, payments, and
            finance workflows are finalized.
          </p>
          <Button asChild>
            <Link href="/payments">Go to Collection desk</Link>
          </Button>
        </CardContent>
      </Card>
    </PageTransition>
  );
}
