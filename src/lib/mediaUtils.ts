import imageCompression from 'browser-image-compression';

export interface MediaFile {
  file: File;
  preview: string;
  type: 'image' | 'video' | 'audio';
}

export const compressImage = async (file: File): Promise<File> => {
  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
    fileType: 'image/webp',
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.error('Error compressing image:', error);
    return file;
  }
};

export const validateMediaFile = (file: File, type: 'image' | 'video' | 'audio'): boolean => {
  const maxSizes = {
    image: 10 * 1024 * 1024, // 10MB
    video: 100 * 1024 * 1024, // 100MB
    audio: 20 * 1024 * 1024, // 20MB
  };

  if (file.size > maxSizes[type]) {
    return false;
  }

  return true;
};

export const getMediaType = (file: File): 'image' | 'video' | 'audio' | null => {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return null;
};
