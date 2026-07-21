"use client";

import { LayersIcon } from "@animateicons/react/lucide";
import { motion } from "framer-motion";

type AuthLoadingScreenProps = {
  message?: string;
  submessage?: string;
};

export function AuthLoadingScreen({
  message = "Loading…",
  submessage,
}: AuthLoadingScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F7FB] px-4 dark:bg-slate-950">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex flex-col items-center gap-6"
      >
        <div className="relative flex h-[4.5rem] w-[4.5rem] items-center justify-center">
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[#4F46E5]/25"
            animate={{ scale: [1, 1.12, 1], opacity: [0.45, 0.15, 0.45] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-[#4F46E5] border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.85, repeat: Infinity, ease: "linear" }}
          />
          <LayersIcon size={30} color="#4F46E5" />
        </div>

        <div className="max-w-xs text-center">
          <p className="text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
            {message}
          </p>
          {submessage ? (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{submessage}</p>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-[#4F46E5]"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -5, 0] }}
              transition={{
                duration: 0.75,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.14,
              }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
