import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';

/**
 * Compresses an image to max 1200px width at 70% quality
 * and saves it to a persistent directory inside the app's document directory.
 */
export async function compressImage(uri: string): Promise<string> {
  try {
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

    return destinationPath;
  } catch (error) {
    console.error('Error compressing image:', error);
    throw error;
  }
}

/**
 * Uploads a local file to Supabase Storage 'incident-media' bucket
 */
export async function uploadToSupabase(
  localPath: string,
  incidentId: string
): Promise<string> {
  try {
    const fileName = localPath.split('/').pop() || `${Date.now()}.jpg`;
    const filePath = `incidents/${incidentId}/${fileName}`;

    // Read the local file as a Blob using the native fetch adapter
    const response = await fetch(localPath);
    const blob = await response.blob();

    const { data, error } = await supabase.storage
      .from('incident-media')
      .upload(filePath, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) {
      throw error;
    }

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('incident-media')
      .getPublicUrl(filePath);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Error uploading to Supabase Storage:', error);
    throw error;
  }
}
