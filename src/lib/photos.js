// Photo capture + persistence helpers.
//
// Photos are stored as compressed JPEG data URLs so they survive app restarts.
// Never persist blob: URLs or native temporary file paths (webPath/uri from the
// camera plugin): those stop working after the app is relaunched.

import { Capacitor } from "@capacitor/core";
import { Camera, CameraDirection } from "@capacitor/camera";

const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.72;

export function isNativeCamera() {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("Camera");
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that photo."));
    image.src = src;
  });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error("Could not read that photo."));
    reader.readAsDataURL(blob);
  });
}

// Downscale + re-encode an image (data URL / object URL / capacitor URL) into a
// compact JPEG data URL. Falls back to the original data URL if canvas fails.
export async function compressImage(src, { maxDimension = MAX_DIMENSION, quality = JPEG_QUALITY } = {}) {
  const image = await loadImage(src);
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
  const width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    if (src.startsWith("data:")) return src;
    throw new Error("Could not process that photo.");
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", quality);
}

export async function fileToPersistentDataUrl(file) {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await compressImage(objectUrl);
  } catch {
    // Some formats (e.g. HEIC on non-Safari browsers) cannot be drawn; keep the raw data.
    return blobToDataUrl(file);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function mediaResultToPersistentDataUrl(result) {
  if (result?.webPath) {
    // webPath is a temporary file served by Capacitor; copy it into a data URL now.
    const response = await fetch(result.webPath);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      return await compressImage(objectUrl);
    } catch {
      return blobToDataUrl(blob);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
  if (result?.thumbnail) {
    const dataUrl = result.thumbnail.startsWith("data:") ? result.thumbnail : `data:image/jpeg;base64,${result.thumbnail}`;
    return compressImage(dataUrl).catch(() => dataUrl);
  }
  throw new Error("The camera did not return a photo.");
}

const CANCEL_CODES = new Set(["OS-PLUG-CAMR-0006", "OS-PLUG-CAMR-0020"]);
const PERMISSION_CODES = new Set(["OS-PLUG-CAMR-0003", "OS-PLUG-CAMR-0005"]);

export function isPermissionDenied(error) {
  return PERMISSION_CODES.has(error?.code);
}

export function isUserCancellation(error) {
  if (CANCEL_CODES.has(error?.code)) return true;
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("cancel") || message.includes("no image picked") || message.includes("no photo");
}

// Native only. Returns a persistent data URL, or null when the user cancelled.
export async function captureNativePhoto({ facing = "rear" } = {}) {
  try {
    const result = await Camera.takePhoto({
      quality: 80,
      targetWidth: MAX_DIMENSION,
      targetHeight: MAX_DIMENSION,
      correctOrientation: true,
      cameraDirection: facing === "front" ? CameraDirection.Front : CameraDirection.Rear,
      saveToGallery: false,
      presentationStyle: "fullscreen",
    });
    return await mediaResultToPersistentDataUrl(result);
  } catch (error) {
    if (isUserCancellation(error)) return null;
    throw error;
  }
}

// Native only. Returns a persistent data URL, or null when the user cancelled.
export async function chooseNativePhoto() {
  try {
    const { results } = await Camera.chooseFromGallery({
      allowMultipleSelection: false,
      quality: 80,
      targetWidth: MAX_DIMENSION,
      targetHeight: MAX_DIMENSION,
      correctOrientation: true,
      presentationStyle: "fullscreen",
    });
    if (!results?.length) return null;
    return await mediaResultToPersistentDataUrl(results[0]);
  } catch (error) {
    if (isUserCancellation(error)) return null;
    throw error;
  }
}
