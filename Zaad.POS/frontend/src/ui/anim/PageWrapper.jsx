import React from "react";
import { motion } from "framer-motion";

/**
 * غلاف يطبّق حركة دخول عامة (rise/slide-up) لكل صفحة
 * ويُوزّع Stagger خفيف. لا يغيّر منطق الصفحات أو بياناتها.
 */
const container = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1, y: 0,
    transition: { duration: 0.35, ease: "easeOut", when: "beforeChildren", staggerChildren: 0.05 }
  },
  exit:  { opacity: 0, y: 12, transition: { duration: 0.18, ease: "easeIn" } }
};

export default function PageWrapper({ children }) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      exit="exit"
      style={{ willChange: "transform, opacity" }}
    >
      {children}
    </motion.div>
  );
}
