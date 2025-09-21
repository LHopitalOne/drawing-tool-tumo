// Storage service: encapsulates UUID generation, JPEG conversion, and upload
import { generateUUID } from '../utils.js';

const SUPABASE_BASE = 'https://wfakwldqhrulbswyiqom.supabase.co/storage/v1/object';
const BUCKET = 'ai-art-files-bucket';
// Note: Public anon key is embedded in client. Consider server-side proxy for production.
const AUTH_HEADER = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndmYWt3bGRxaHJ1bGJzd3lpcW9tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI0MDMwNzEsImV4cCI6MjA2Nzk3OTA3MX0.z7SQGca7x0o1pzAaCyZpZDk4IIdhnImUZAdEr-PtGlQ';

export function createFilename(ext = 'jpg') {
  const uuid = generateUUID();
  return `${uuid}.${ext}`;
}

export function getUploadUrl(filename) {
  return `${SUPABASE_BASE}/${BUCKET}/${filename}`;
}

export function getPublicUrl(filename) {
  return `${SUPABASE_BASE}/public/${BUCKET}/${filename}`;
}

export async function uploadBlobToSupabase(blob, filename) {
  const url = getUploadUrl(filename);
  const formData = new FormData();
  formData.append('file', blob, filename);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': AUTH_HEADER },
    body: formData,
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  return getPublicUrl(filename);
}

export async function ensureJpegBlob(fileOrBlob) {
  // If already JPEG, return as-is
  const type = fileOrBlob && fileOrBlob.type ? fileOrBlob.type : '';
  if (type.includes('jpeg') || type.includes('jpg')) return fileOrBlob;

  const img = await fileOrBlobToImage(fileOrBlob);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
}

export function canvasToJpegBlob(canvas, quality = 0.95) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

export function fileOrBlobToObjectUrl(b) {
  return URL.createObjectURL(b);
}

export function revokeObjectUrl(url) {
  try { URL.revokeObjectURL(url); } catch (_) {}
}

export function fileOrBlobDownload(url, filename) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function fileOrBlobToImage(file) {
  if (file instanceof Blob && !(file instanceof File)) {
    const url = URL.createObjectURL(file);
    try {
      const img = await urlToImage(url);
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return await fileToImage(file);
}

export function fileToImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = function (event) {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function urlToImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}


