# Process Voice Edge Function

Supabase Edge Function for voice-to-incident processing using **Gemini 3 Flash**.

## Features

- 🎙️ Accepts audio files (m4a, mp4, webm, wav, ogg)
- 🧠 Processes Darija/French/Arabic speech
- 📋 Returns structured incident JSON
- ⚡ ~200ms latency with Gemini 3 Flash

## Deployment

```bash
# Set the API key secret
supabase secrets set GEMINI_API_KEY=your_api_key

# Deploy the function
supabase functions deploy process-voice
```

## Request Format

```bash
curl -X POST \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -F "file=@recording.m4a" \
  https://YOUR_PROJECT.supabase.co/functions/v1/process-voice
```

## Response Format

```json
{
  "output": {
    "type": "BT",
    "village": "Douar Sidi Ahmed",
    "commune_id": null,
    "incident_type": "poteau incliné",
    "equipment_used": "poteau béton",
    "description": "Le poteau près de l'école est incliné...",
    "title": "Poteau incliné - Douar Sidi Ahmed",
    "date": "2026-01-20T14:00:00.000Z",
    "reclamation": false,
    "reclamation_name": null,
    "reclamation_by": null,
    "status": "open",
    "media_urls": []
  }
}
```
