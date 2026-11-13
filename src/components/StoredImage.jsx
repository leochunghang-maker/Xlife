import { useEffect, useState } from "react";
import { isPhotoRef, resolvePhoto } from "../lib/photoStore";

// <img> that understands photo references from the photo store as well as
// legacy data URLs. Renders a neutral placeholder while loading or if missing.
export function StoredImage({ src, alt = "", className = "", ...props }) {
  const [resolved, setResolved] = useState({ src: "", url: "" });
  useEffect(() => {
    if (!isPhotoRef(src)) return undefined;
    let active = true;
    resolvePhoto(src).then((url) => {
      if (active) setResolved({ src, url });
    });
    return () => {
      active = false;
    };
  }, [src]);
  const url = isPhotoRef(src) ? (resolved.src === src ? resolved.url : "") : src;
  if (!url) {
    return <div role="img" aria-label={alt || "Photo"} className={`bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
  }
  return <img src={url} alt={alt} loading="lazy" decoding="async" className={className} {...props} />;
}
