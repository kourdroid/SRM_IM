import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, supabaseAnonKey, supabaseUrl } from './supabase';

/**
 * Compresses an image to max 1200px width at 70% quality
 * and saves it to a persistent directory inside the app's document directory.
 */
export async function compressImage(uri: string): Promise<string> {
  try {
    if (!FileSystem.documentDirectory) {
      throw new Error('Document directory is not available on this device.');
    }

    // Ensure persistent directory exists
    const dir = `${FileSystem.documentDirectory}compressed_images/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }

    // Manipulate the image (resizing automatically maintains aspect ratio if only width is specified)
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 1200 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );

    // Save to our persistent folder
    const fileName = `${Date.now()}_compressed.jpg`;
    const destinationPath = `${dir}${fileName}`;
    await FileSystem.copyAsync({
      from: result.uri,
      to: destinationPath,
    });
    if (result.uri !== uri) {
      await FileSystem.deleteAsync(result.uri, { idempotent: true }).catch(() => undefined);
    }

    return destinationPath;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}

/**
 * Copies a picked or captured media file into app-owned persistent storage.
 * This is intentionally cheap and does not compress; compression happens during sync.
 */
export async function persistIncidentMedia(uri: string, clientMediaId: string): Promise<string> {
  if (!FileSystem.documentDirectory) {
    throw new Error('Document directory is not available on this device.');
  }

  const dir = `${FileSystem.documentDirectory}incident_media_pending/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }

  const destinationPath = `${dir}${clientMediaId}.jpg`;
  await FileSystem.copyAsync({
    from: uri,
    to: destinationPath,
  });

  return destinationPath;
}

/**
 * Uploads a local file to Supabase Storage 'incident-media' bucket
 */
export async function uploadToSupabase(
  localPath: string,
  incidentId: string,
  objectName?: string
): Promise<{ publicUrl: string; storagePath: string }> {
  let uploadPath: string | null = null;
  try {
    const info = await FileSystem.getInfoAsync(localPath);
    if (!info.exists) {
      throw new Error(`Local media file not found: ${localPath}`);
    }

    uploadPath = await compressImage(localPath);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      throw new Error(sessionError?.message || 'User session is required for media upload.');
    }

    const fileName = objectName || uploadPath.split('/').pop() || `${Date.now()}.jpg`;
    const filePath = `incidents/${incidentId}/${fileName}`;
    const encodedPath = filePath.split('/').map(encodeURIComponent).join('/');
    const uploadUrl = `${supabaseUrl}/storage/v1/object/incident-media/${encodedPath}`;

    const result = await FileSystem.uploadAsync(uploadUrl, uploadPath, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true',
      },
    });

    if (result.status < 200 || result.status >= 300) {
      throw new Error(`Storage upload failed (${result.status}): ${result.body}`);
    }

    const { data: publicUrlData } = supabase.storage
      .from('incident-media')
      .getPublicUrl(filePath);

    return { publicUrl: publicUrlData.publicUrl, storagePath: filePath };
  } catch (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw error;
  } finally {
    if (uploadPath) {
      await deleteLocalMedia(uploadPath);
    }
  }
}

export async function deleteLocalMedia(uri: string): Promise<void> {
  if (!uri.startsWith('file:')) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}
