"use client";

import { Children } from "react";
import { motion } from "framer-motion";
import { staggerContainer, fadeSlideUp } from "@/lib/motion";
import { cn } from "@/lib/utils";

export function StaggerGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-40px" }}
      className={cn("grid", className)}
    >
      {Children.map(children, (child) => (
        <motion.div variants={fadeSlideUp} className="view-fade-in">
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
