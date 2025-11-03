// /src/lib/mediaUtils.ts
import imageCompression from "browser-image-compression";

export interface MediaFile {
  file: File;
  preview: string;
  type: "image" | "video" | "audio";
}

const MB = 1024 * 1024;
export const MAX_IMAGE = 15 * MB;
export const MAX_VIDEO = 15 * MB;
export const MAX_AUDIO = 10 * MB;

export const maxSizeLabel = (t: "image" | "video" | "audio") =>
  t === "image" ? "15 MB" : t === "video" ? "15 MB" : "10 MB";

export const getMediaType = (file: File): "image" | "video" | "audio" | null => {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return null;
};

export const validateMediaFile = (file: File, type: "image" | "video" | "audio"): boolean => {
  const limit = type === "image" ? MAX_IMAGE : type === "video" ? MAX_VIDEO : MAX_AUDIO;
  return file.size <= limit;
};

export const compressImage = async (file: File): Promise<File> => {
  if (file.size <= 1.2 * MB) return file;
  const options = { maxSizeMB: 1, maxWidthOrHeight: 1920, useWebWorker: true, fileType: "image/webp" as const };
  try {
    const compressed = await imageCompression(file, options);
    const name = file.name.replace(/\.[^.]+$/, ".webp");
    return new File([compressed], name, { type: "image/webp", lastModified: Date.now() });
  } catch {
    return file;
  }
};