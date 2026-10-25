import { useEffect, useState } from 'react';

/** Shows a chosen photo. The temporary URL is created once per file and released afterwards. */
export default function PhotoPreview({ file }: { file: File | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setUrl(null); return; }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url ? <img className="preview" alt="" src={url} /> : null;
}
