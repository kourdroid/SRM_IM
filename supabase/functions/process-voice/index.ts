import { encodeBase64 } from "jsr:@std/encoding/base64";
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { GoogleGenAI, Type } from "npm:@google/genai";

// --- CONFIGURATION ---
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
if (!GEMINI_API_KEY) {
    throw new Error("FATAL: GEMINI_API_KEY secret is not configured");
}

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

// --- Supported Audio Types ---
const SUPPORTED_AUDIO_TYPES = [
    "audio/m4a",
    "audio/mp4",
    "audio/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
];

// --- SYSTEM PROMPT (Immutable Law) ---
const SYSTEM_PROMPT = `
You are an expert incident-structuring agent for the ONEE/SRM electricity system.
TASK: Listen to the audio and convert the speech (Darija/French/Moroccan Arabic) into a structured JSON object.

═══════════════════════════════════════════════════════════════════
CRITICAL FIELD DEFINITIONS:
═══════════════════════════════════════════════════════════════════
- "type": ONLY "BT" (Basse Tension) or "MT" (Moyenne Tension). Default to "BT" if unclear.
- "village": Extract the location name (douar, village, quartier).
- "incident_type": What happened (e.g., "poteau incliné", "câble arraché", "transformateur brûlé").
- "equipment_used": Materials mentioned (e.g., "transformateur 250 KVA", "poteau béton"). If unknown, use empty string.
- "reclamation": Boolean. True ONLY if speaker says "réclamation", "plainte", or mentions a citizen reporting it.
- "reclamation_name": Name of the person who complained, or null.
- "reclamation_by": Source (Administration, Client, Mairie) or null.
- "date": ISO 8601 format. If not mentioned, use the current time.
- "title": A short, descriptive title for the incident.
- "description": A full transcription/summary of what was said.

Return a structured JSON object with the extracted incident data.
`;

// --- HANDLER ---
Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    try {
        // A. Validate Request
        const formData = await req.formData();
        const file = formData.get("file");

        if (!file || !(file instanceof File)) {
            return new Response(
                JSON.stringify({ error: "Missing file in FormData. Key must be 'file'." }),
                { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        }

        // B. Validate MIME Type
        const mimeType = file.type || "audio/m4a";
        if (!SUPPORTED_AUDIO_TYPES.includes(mimeType)) {
            return new Response(
                JSON.stringify({
                    error: `Unsupported audio type: ${mimeType}`,
                    supported: SUPPORTED_AUDIO_TYPES,
                }),
                { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
            );
        }

        console.log(`[Processing] Received audio: ${file.name}, Size: ${file.size} bytes, Type: ${mimeType}`);

        // C. Convert audio to base64
        const arrayBuffer = await file.arrayBuffer();
        const base64Audio = encodeBase64(new Uint8Array(arrayBuffer));

        // D. Call Gemini 3 Flash with Structured Output Schema
        console.log("[Gemini] Sending to gemini-3-flash-preview...");
        const start = performance.now();

        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: {
                parts: [
                    { text: SYSTEM_PROMPT },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Audio,
                        },
                    },
                ],
            },
            config: {
                temperature: 0.2, // Deterministic = faster inference
                maxOutputTokens: 2000, // Limit response size
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        output: {
                            type: Type.OBJECT,
                            description: "The structured incident data extracted from audio",
                            properties: {
                                type: {
                                    type: Type.STRING,
                                    description: "Voltage type: BT (Basse Tension) or MT (Moyenne Tension)",
                                    enum: ["BT", "MT"],
                                },
                                village: {
                                    type: Type.STRING,
                                    description: "Location name (douar, village, quartier)",
                                    nullable: true,
                                },
                                commune_id: {
                                    type: Type.STRING,
                                    description: "Commune ID (always null, will be set by client)",
                                    nullable: true,
                                },
                                incident_type: {
                                    type: Type.STRING,
                                    description: "What happened (e.g., poteau incliné, câble arraché)",
                                },
                                equipment_used: {
                                    type: Type.STRING,
                                    description: "Materials mentioned or empty string",
                                },
                                description: {
                                    type: Type.STRING,
                                    description: "Full transcription/summary of the audio",
                                },
                                title: {
                                    type: Type.STRING,
                                    description: "Short descriptive title for the incident",
                                },
                                date: {
                                    type: Type.STRING,
                                    description: "ISO 8601 date string",
                                },
                                reclamation: {
                                    type: Type.BOOLEAN,
                                    description: "Whether this is a citizen complaint",
                                },
                                reclamation_name: {
                                    type: Type.STRING,
                                    description: "Name of the complainant",
                                    nullable: true,
                                },
                                reclamation_by: {
                                    type: Type.STRING,
                                    description: "Source of reclamation (Administration, Client, Mairie)",
                                    nullable: true,
                                },
                                status: {
                                    type: Type.STRING,
                                    description: "Incident status (always 'open' for new incidents)",
                                    enum: ["open"],
                                },
                                media_urls: {
                                    type: Type.ARRAY,
                                    description: "Media URLs (empty for new incidents)",
                                    items: { type: Type.STRING },
                                },
                            },
                            required: [
                                "type",
                                "incident_type",
                                "description",
                                "title",
                                "date",
                                "reclamation",
                                "status",
                            ],
                        },
                    },
                    required: ["output"],
                },
            },
        });

        const duration = Math.round(performance.now() - start);
        console.log(`[Gemini] Completed in ${duration}ms`);

        // E. Parse and return
        const result = JSON.parse(response.text);

        // F. Apply defaults for optional fields
        const output = result.output;
        output.commune_id = null;
        output.equipment_used = output.equipment_used || "";
        output.media_urls = output.media_urls || [];
        output.status = "open";

        return new Response(JSON.stringify({ output }), {
            status: 200,
            headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });

    } catch (error: unknown) {
        console.error("[Edge Function Error]", error);

        const message = error instanceof Error ? error.message : "Unknown error";

        return new Response(
            JSON.stringify({
                error: "Voice processing failed",
                details: message,
            }),
            {
                status: 500,
                headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
            }
        );
    }
});
