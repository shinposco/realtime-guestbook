"use client";

import { useEffect, useState } from "react";

export function Artwork({ image, alt, className }: { image: Blob | string; alt: string; className: string }) {
  const [preview, setPreview] = useState<{ image: Blob; url: string }>();
  useEffect(() => {
    if (typeof image === "string") return;
    const url = URL.createObjectURL(image);
    setPreview({ image, url });
    return () => URL.revokeObjectURL(url);
  }, [image]);

  if (typeof image === "string") return <img src={image} alt={alt} className={className} />;
  if (preview?.image !== image) return <span aria-hidden="true" className={className} />;
  return <img src={preview.url} alt={alt} className={className} />;
}
