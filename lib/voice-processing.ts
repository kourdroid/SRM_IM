/**
 * Voice Processing Service
 *
 * Clean Architecture: Infrastructure Layer
 * Handles communication with the Supabase Edge Function for voice-to-incident processing.
 */

import { supabase } from './supabase';

// --- Types ---

export interface VoiceProcessingResult {
    type: 'BT' | 'MT';
    village: string | null;
    commune_id: string | null;
    incident_type: string;
    equipment_used: string;
    description: string;
    title: string;
    date: string;
    reclamation: boolean;
    reclamation_name: string | null;
    reclamation_by: string | null;
    status: 'open';
    media_urls: string[];
}

export interface VoiceProcessingResponse {
    output: VoiceProcessingResult;
}

export interface VoiceProcessingError {
    error: string;
    details?: string;
}

// --- Service ---

/**
 * Process a voice recording and extract incident data using AI.
 *
 * @param audioUri - Local URI of the audio file (from expo-av)
 * @param userId - ID of the current user for logging
 * @returns Structured incident data extracted from the audio
 * @throws Error if processing fails
 */
export async function processVoiceRecording(
    audioUri: string,
    userId: string
): Promise<VoiceProcessingResult> {
    console.log('[VoiceProcessing] === START ===');
    console.log('[VoiceProcessing] Audio URI:', audioUri);
    console.log('[VoiceProcessing] User ID:', userId);

    // 1. Build FormData payload
    const formData = new FormData();
    formData.append('file', {
        uri: audioUri,
        type: 'audio/m4a',
        name: `recording_${Date.now()}.m4a`,
    } as unknown as Blob);

    console.log('[VoiceProcessing] FormData created');

    // 2. Get the current session for auth header
    const { data: { session } } = await supabase.auth.getSession();

    if (!session) {
        console.error('[VoiceProcessing] No active session found');
        throw new Error('User is not authenticated');
    }

    console.log('[VoiceProcessing] Session retrieved, user:', session.user.id);

    // 3. Call Edge Function
    const functionUrl = process.env.EXPO_PUBLIC_VOICE_FUNCTION_URL;

    if (!functionUrl) {
        console.error('[VoiceProcessing] EXPO_PUBLIC_VOICE_FUNCTION_URL not set');
        throw new Error('EXPO_PUBLIC_VOICE_FUNCTION_URL is not configured');
    }

    console.log('[VoiceProcessing] Function URL:', functionUrl);
    console.log('[VoiceProcessing] Sending audio to Edge Function...');
    const start = performance.now();

    try {
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${session.access_token}`,
                'Accept': 'application/json',
            },
            body: formData,
        });

        const duration = Math.round(performance.now() - start);
        console.log(`[VoiceProcessing] Response received in ${duration}ms`);
        console.log(`[VoiceProcessing] Response status: ${response.status}`);
        console.log(`[VoiceProcessing] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries())));

        // 4. Handle errors
        if (!response.ok) {
            const errorText = await response.text();
            console.error('[VoiceProcessing] Error response body:', errorText);

            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch {
                errorData = { error: errorText || 'Unknown error' };
            }

            console.error('[VoiceProcessing] Parsed error:', errorData);
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        // 5. Parse response
        const responseText = await response.text();
        console.log('[VoiceProcessing] Response body:', responseText);

        const result: VoiceProcessingResponse = JSON.parse(responseText);

        if (!result.output) {
            console.error('[VoiceProcessing] Invalid response structure:', result);
            throw new Error('Invalid response from voice processing service');
        }

        console.log('[VoiceProcessing] Successfully extracted incident data');
        console.log('[VoiceProcessing] === END ===');
        return result.output;
    } catch (error) {
        console.error('[VoiceProcessing] Fetch error:', error);
        console.error('[VoiceProcessing] Error details:', JSON.stringify(error, null, 2));
        throw error;
    }
}
