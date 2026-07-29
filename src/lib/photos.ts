import { supabase } from './supabase';

/**
 * Photos are the only part of this database that grows without bound, and the
 * cost ceiling is a few euros a month. So the phone downscales before upload:
 * a long edge of 1600 px at JPEG q0.82 lands around 250–350 KB, which is plenty
 * for identifying damage on a trunk, plus a 320 px thumbnail for the galleries.
 * The owner keeps full-resolution originals on the phone.
 */

const FULL_EDGE = 1600;
const THUMB_EDGE = 320;
const QUALITY = 0.82;

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
	if ('createImageBitmap' in window) {
		return createImageBitmap(file);
	}
	const url = URL.createObjectURL(file);
	try {
		const img = new Image();
		img.src = url;
		await img.decode();
		return img;
	} finally {
		URL.revokeObjectURL(url);
	}
}

function resize(
	src: ImageBitmap | HTMLImageElement,
	maxEdge: number
): Promise<Blob> {
	const w = 'width' in src ? src.width : 0;
	const h = 'height' in src ? src.height : 0;
	const scale = Math.min(1, maxEdge / Math.max(w, h));
	const canvas = document.createElement('canvas');
	canvas.width = Math.round(w * scale);
	canvas.height = Math.round(h * scale);
	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(src as CanvasImageSource, 0, 0, canvas.width, canvas.height);
	return new Promise((resolve, reject) =>
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob failed'))),
			'image/jpeg',
			QUALITY
		)
	);
}

export interface UploadedPhoto {
	storage_path: string;
	thumb_path: string;
	taken_at: string;
}

export async function uploadPhoto(file: File, folder: string): Promise<UploadedPhoto> {
	const bitmap = await loadBitmap(file);
	const [full, thumb] = await Promise.all([
		resize(bitmap, FULL_EDGE),
		resize(bitmap, THUMB_EDGE)
	]);
	if ('close' in bitmap) bitmap.close();

	const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
	const storage_path = `${folder}/${stamp}.jpg`;
	const thumb_path = `${folder}/${stamp}-thumb.jpg`;

	const bucket = supabase.storage.from('photos');
	const opts = { contentType: 'image/jpeg', upsert: false };
	const [a, b] = await Promise.all([
		bucket.upload(storage_path, full, opts),
		bucket.upload(thumb_path, thumb, opts)
	]);
	if (a.error) throw a.error;
	if (b.error) throw b.error;

	return {
		storage_path,
		thumb_path,
		taken_at: new Date(file.lastModified || Date.now()).toISOString()
	};
}
