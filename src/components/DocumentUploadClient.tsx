"use client";

import { useEffect, useState } from "react";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "application/pdf"]);

export function DocumentUploadClient() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<{ name: string; type: string; size: number; width?: number; height?: number; warnings: string[] } | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function onFileChange(file: File | undefined) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (!file) {
      setFileInfo(null);
      return;
    }

    const warnings: string[] = [];
    if (!supportedTypes.has(file.type)) warnings.push("Unsupported format. Use JPEG, PNG, WebP, HEIC/HEIF when available, or PDF.");
    if (file.size > 20 * 1024 * 1024) warnings.push("The file is large; upload and extraction may be slow.");
    const nextInfo = { name: file.name, type: file.type || "unknown", size: file.size, warnings };
    setFileInfo(nextInfo);

    if (file.type.startsWith("image/")) {
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      const image = new Image();
      image.onload = () => {
        const imageWarnings = [...warnings];
        if (image.naturalWidth < 900 || image.naturalHeight < 900) imageWarnings.push("The photo may be low resolution.");
        if (image.naturalWidth > image.naturalHeight) imageWarnings.push("The photo appears landscape; confirm the full sheet is visible.");
        setFileInfo({ ...nextInfo, width: image.naturalWidth, height: image.naturalHeight, warnings: imageWarnings });
      };
      image.onerror = () => setFileInfo({ ...nextInfo, warnings: [...warnings, "The image could not be decoded by the browser."] });
      image.src = objectUrl;
    }
  }

  return (
    <form className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-2">
      <label className="grid gap-1">Document type<select className="rounded border p-2"><option>daily_sheet</option><option>roster</option><option>payslip</option></select></label>
      <label className="grid gap-1">Document date<input className="rounded border p-2" type="date" /></label>
      <label className="grid gap-1 md:col-span-2">Phone photo or PDF<input className="rounded border p-2" type="file" accept="image/*,.pdf" capture="environment" onChange={(event) => onFileChange(event.currentTarget.files?.[0])} /></label>
      <label className="grid gap-1">Extractor<select className="rounded border p-2"><option>Paddle OCR</option><option>Manual entry</option></select></label>
      <p className="rounded bg-stone-100 p-3 text-sm">This page validates a local preview only. Assign saved photos from the Photo inbox before OCR or row review.</p>
      <div className="rounded bg-amber-50 p-3 text-sm text-amber-900">Quality warnings are advisory: blurry, dark, bright, or missing-edge photos can continue to manual review.</div>
      {fileInfo ? (
        <div className="space-y-3 rounded border p-3 md:col-span-2">
          <div>
            <h2 className="font-semibold">Selected file</h2>
            <p className="text-sm text-stone-700">{fileInfo.name} · {fileInfo.type} · {(fileInfo.size / 1024 / 1024).toFixed(2)} MB</p>
            {fileInfo.width && fileInfo.height ? <p className="text-sm text-stone-700">{fileInfo.width} x {fileInfo.height}px</p> : null}
          </div>
          {fileInfo.warnings.length ? <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800">{fileInfo.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul> : <p className="text-sm text-green-700">No basic client-side warnings.</p>}
          {previewUrl ? <img alt="Selected document preview" className="max-h-[520px] rounded border object-contain" src={previewUrl} /> : <p className="text-sm text-stone-600">PDF preview will be available after upload.</p>}
        </div>
      ) : null}
    </form>
  );
}
