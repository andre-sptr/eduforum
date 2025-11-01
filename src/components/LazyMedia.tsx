import React, { useEffect, useRef, useState } from "react";

type Props = {
  url: string;
  alt: string;
  className?: string;
  aspect?: "video" | "square" | "16/9" | "4/3" | "3/4" | "1/1";
  objectFit?: "cover" | "contain";
};

const getExt = (u: string) => (u.split(".").pop() || "").toLowerCase().split("?")[0];
const isImg = (e: string) => ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(e);
const isVid = (e: string) => ["mp4", "webm", "ogg"].includes(e);

const aspectClass = (a?: Props["aspect"]) => {
  switch (a) {
    case "square":
    case "1/1":
      return "aspect-square";
    case "16/9":
    case "video":
      return "aspect-video";
    case "4/3":
      return "aspect-[4/3]";
    case "3/4":
      return "aspect-[3/4]";
    default:
      return "aspect-video";
  }
};

export const LazyMedia: React.FC<Props> = ({ url, alt, className, aspect = "video", objectFit = "cover" }) => {
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const holderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = holderRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisible(true);
          const ext = getExt(url);
          if (!isImg(ext) && !isVid(ext)) {
            setLoaded(true);
          }
          io.disconnect();
        }
      },
      { rootMargin: "400px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [url]);

  const ext = getExt(url);
  const showSkeleton = !visible || !loaded;
  const fitCls = objectFit === "contain" ? "object-contain" : "object-cover";

  return (
    <div ref={holderRef} className={`relative overflow-hidden rounded-lg border bg-muted ${aspectClass(aspect)} ${className || ""}`}>
      {showSkeleton && <div className="absolute inset-0 animate-pulse bg-muted" />}
      {visible && isImg(ext) && (
        <img
          src={url}
          alt={alt}
          className={`w-full h-full ${fitCls} ${showSkeleton ? "opacity-0" : "opacity-100"} transition-opacity`}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
        />
      )}
      {visible && isVid(ext) && (
        <video
          src={url}
          className={`w-full h-full ${fitCls} bg-black ${showSkeleton ? "opacity-0" : "opacity-100"} transition-opacity`}
          controls
          playsInline
          preload="metadata"
          onLoadedData={() => setLoaded(true)}
        />
      )}
      {visible && !isImg(ext) && !isVid(ext) && (
        <a
          href={url}
          download
          target="_blank"
          rel="noopener noreferrer"
          className={`absolute inset-0 flex items-center justify-center bg-card text-sm ${showSkeleton ? "opacity-0" : "opacity-100"} transition-opacity`}
        >
          Unduh berkas
        </a>
      )}
    </div>
  );
};

export default LazyMedia;