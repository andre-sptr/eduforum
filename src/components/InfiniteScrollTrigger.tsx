import React, { useEffect, useRef } from "react";

type Props = {
  onLoadMore: () => void;
  disabled?: boolean;
};

export const InfiniteScrollTrigger: React.FC<Props> = ({ onLoadMore, disabled }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore();
      },
      { rootMargin: "600px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [onLoadMore, disabled]);
  return <div ref={ref} className="h-8" />;
};