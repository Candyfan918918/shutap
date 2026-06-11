// Alias birthday — in-stream moment card, swipe to dismiss. No push.
import { motion, useMotionValue, useTransform } from "framer-motion";
import { useState } from "react";

type Props = {
  emoji: string;
  fullAlias: string;
  verdictsCast: number;
  courtAppearances: number;
  emotion: string;
  onDismiss?: () => void;
};

export function AliasBirthdayCard({
  emoji, fullAlias, verdictsCast, courtAppearances, emotion, onDismiss,
}: Props) {
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-180, 0, 180], [0, 1, 0]);
  const [gone, setGone] = useState(false);
  if (gone) return null;

  return (
    <motion.article
      drag="x"
      style={{ x, opacity }}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 120) {
          setGone(true);
          onDismiss?.();
        }
      }}
      className="rounded-2xl border border-border bg-card p-4 my-3 shadow-sm"
    >
      <p className="text-foreground text-base leading-relaxed">
        <span className="mr-2">{emoji}</span>
        <span className="font-medium">{fullAlias}</span> has existed for one year.
        {" "}{verdictsCast.toLocaleString()} verdicts cast.
        {" "}{courtAppearances} Court appearance{courtAppearances === 1 ? "" : "s"}.
        {" "}{emotion} as ever.
      </p>
      <p className="text-muted-foreground text-xs mt-2">Swipe to dismiss.</p>
    </motion.article>
  );
}
