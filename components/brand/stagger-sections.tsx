"use client";

import { Children } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Igual que StaggerGrid, pero para bloques de sección apilados (no una grilla), animados al montar. */
export function StaggerSections({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="show" className={cn(className)}>
      {Children.map(children, (child) => (
        <motion.div variants={fadeSlideUp}>{child}</motion.div>
      ))}
    </motion.div>
  );
}
