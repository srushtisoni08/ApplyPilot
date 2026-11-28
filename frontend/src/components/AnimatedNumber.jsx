import { useEffect, useRef } from "react";
import { animate, useReducedMotion } from "framer-motion";

/** Counts up to `value`. Re-animates from the previous value when it changes. */
export default function AnimatedNumber({ value, duration = 0.9, format = (n) => Math.round(n).toLocaleString() }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const target = Number(value) || 0;

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (reduce) {
      node.textContent = format(target);
      node.dataset.from = String(target);
      return undefined;
    }
    const controls = animate(Number(node.dataset.from || 0), target, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => {
        node.textContent = format(v);
        node.dataset.from = String(v);
      },
    });
    return () => controls.stop();
    // format is intentionally not a dependency: callers pass inline functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, reduce]);

  return (
    <span ref={ref} className="num">
      {format(0)}
    </span>
  );
}