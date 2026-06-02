import VoiceRecorderOverlay from "@/components/VoiceRecorderOverlay";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { useSharedValue } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { enqueueCreateIncident, enqueueMediaUpload } from '../../db/syncOperations';
import { useSync } from '../../hooks/useSync';
import { persistIncidentMedia } from '../../lib/imageUtils';
import { processVoiceRecording } from '../../lib/voice-processing';
import { getIncidentTypesForType } from "../../src/core/constants/incidentTypes";

// Defines
interface Commune {
  id: number;
  name: string;
  remote_id: string | null;
}

export default function CreateIncidentScreen() {
  const { user } = useAuth();
  const db = useSQLiteContext();
  const { syncPendingItems } = useSync(user?.id);

  // Form State
  const [type, setType] = useState<"BT" | "MT">("BT");
  const [incidentDate, setIncidentDate] = useState(new Date());
  const [commune, setCommune] = useState("");
  const [communeSearch, setCommuneSearch] = useState("");
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [village, setVillage] = useState("");
  const [incidentType, setIncidentType] = useState<string>(getIncidentTypesForType("BT")[0]);
  const [equipment, setEquipment] = useState("");
  const [description, setDescription] = useState("");
  const [isReclamation, setIsReclamation] = useState(false);
  const [reclamationName, setReclamationName] = useState("");
  const [reclamationBy, setReclamationBy] = useState("Administration");
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  } | null>(null);
  const [isCapturingLocation, setIsCapturingLocation] = useState(false);

  // Voice State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [voiceMode, setVoiceMode] = useState(true);

  // UI State
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Reset form every time the screen gains focus (tab switching preserves state)
  useFocusEffect(
    useCallback(() => {
      setCurrentStep(1);
      setType("BT");
      setIncidentDate(new Date());
      setCommune("");
      setCommuneSearch("");
      setVillage("");
      setIncidentType(getIncidentTypesForType("BT")[0]);
      setEquipment("");
      setDescription("");
      setIsReclamation(false);
      setReclamationName("");
      setReclamationBy("Administration");
      setSelectedImages([]);
      setGpsLocation(null);
      setVoiceMode(true);
      setRecordingDuration(0);
    }, [])
  );

  // Load Communes
  useEffect(() => {
    const loadCommunes = async () => {
      try {
        const rows = await db.getAllAsync<Commune>('SELECT * FROM communes ORDER BY name ASC');
        setCommunes(rows);
      } catch (e) {
        console.error("Failed to load communes", e);
      }
    };
    loadCommunes();
  }, [db]);

  // Animation for Mic
  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isRecording, pulseAnim]);

  useEffect(() => {
    const incidentTypes = getIncidentTypesForType(type);
    if (!(incidentTypes as readonly string[]).includes(incidentType)) {
      setIncidentType(incidentTypes[0]);
    }
  }, [type, incidentType]);

  async function startRecording() {
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status === 'granted') {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });

        // Enable metering in options
        const options = {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
          android: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
            isMeteringEnabled: true
          },
          ios: {
            ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
            isMeteringEnabled: true
          }
        };

        const { recording } = await Audio.Recording.createAsync(options);

        // Hook up status updates for metering and duration
        recording.setOnRecordingStatusUpdate((status) => {
          if (status.isRecording) {
            setRecordingDuration(status.durationMillis);
            if (status.metering !== undefined) {
              metering.value = status.metering;
            }
          }
        });

        setRecording(recording);
        setIsRecording(true);
      } else {
        Alert.alert("Permission refusée", "L'accès au microphone est nécessaire.");
      }
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  async function stopRecording() {
    if (!recording) return;
    setIsRecording(false);
    setIsProcessingAudio(true);

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecording(null);

      if (!uri) {
        Alert.alert("Erreur", "Impossible d'obtenir l'enregistrement audio.");
        setIsProcessingAudio(false);
        return;
      }

      // Process audio using Supabase Edge Function
      const data = await processVoiceRecording(uri, user?.id || 'unknown');

      debugLog('=== Voice AI Response ===');
      debugLog('Full data:', JSON.stringify(data, null, 2));

      // Pre-fill form with extracted data
      if (data.type && (data.type === 'BT' || data.type === 'MT')) {
        debugLog('Setting type:', data.type);
        setType(data.type);
      }
      if (data.village) {
        debugLog('Setting village:', data.village);
        setVillage(data.village);
      }
      if (data.commune_id) {
        debugLog('Setting commune:', data.commune_id);
        setCommune(data.commune_id);
      }
      if (data.equipment_used && data.equipment_used.trim() !== '') {
        debugLog('Setting equipment:', data.equipment_used);
        setEquipment(data.equipment_used);
      }
      if (data.incident_type) {
        debugLog('Incident type from AI:', data.incident_type);
        setIncidentType(data.incident_type);
        // Use incident_type as equipment if empty
        if (!data.equipment_used || data.equipment_used.trim() === '') {
          setEquipment(data.incident_type);
          debugLog('Using incident_type as equipment:', data.incident_type);
        }
      }
      if (data.reclamation === true || data.reclamation === false) {
        debugLog('Setting reclamation:', data.reclamation);
        setIsReclamation(data.reclamation);
      }
      if (data.reclamation_name) {
        debugLog('Setting reclamation_name:', data.reclamation_name);
        setReclamationName(data.reclamation_name);
      }
      if (data.reclamation_by) {
        debugLog('Setting reclamation_by:', data.reclamation_by);
        setReclamationBy(data.reclamation_by);
      }
      if (data.date) {
        try {
          const parsedDate = new Date(data.date);
          debugLog('Setting date:', parsedDate);
          setIncidentDate(parsedDate);
        } catch {
          debugLog('Could not parse date:', data.date);
        }
      }

      debugLog('=== Form Fill Complete ===');

      Alert.alert(
        "Traitement Terminé",
        data.description || "Les informations ont été extraites. Veuillez vérifier et compléter si nécessaire."
      );
      setVoiceMode(false);
    } catch (error) {
      console.error("Error processing audio:", error);
      Alert.alert(
        "Erreur",
        "Une erreur est survenue lors du traitement de l'audio. Veuillez réessayer ou utiliser la saisie manuelle."
      );
    } finally {
      setIsProcessingAudio(false);
    }
  }

  // Helpers
  const formatDate = (date: Date) => {
    return `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}/${date.getFullYear()} ${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    const currentDate = selectedDate || incidentDate;
    if (event.type === "set") {
      if (showDatePicker) {
        setShowDatePicker(false);
        setShowTimePicker(true);
      } else {
        setShowTimePicker(false);
      }
      setIncidentDate(currentDate);
    } else {
      setShowDatePicker(false);
      setShowTimePicker(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setSelectedImages(prev => [...prev, ...result.assets.map(asset => asset.uri)]);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission refusée", "L'accès à la caméra est nécessaire pour joindre une photo.");
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setSelectedImages(prev => [...prev, result.assets[0].uri]);
    }
  };

  const removeImage = (uri: string) => {
    setSelectedImages(prev => prev.filter(item => item !== uri));
  };

  const handleSubmit = async () => {
    if (!user?.id) {
      Alert.alert("Erreur", "Utilisateur non authentifié.");
      return;
    }

    if (!communes.some(item => item.remote_id)) {
      Alert.alert("Communes indisponibles", "Synchronisez les communes avant de créer un incident.");
      return;
    }

    if (!commune || !village || !incidentType || !equipment) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      setIsSubmitting(true);
      const location = gpsLocation || await captureLocation();
      const clientId = createClientId();
      let localIncidentId: number | null = null;
      let mediaPreparationFailed = false;

      const incidentData = {
        client_id: clientId,
        type,
        date: incidentDate.toISOString(),
        village,
        status: 'open',
        incident_type: incidentType,
        commune_id: commune,
        equipment_used: equipment,
        description: description.trim() || null,
        reclamation: isReclamation ? 1 : 0,
        reclamation_name: reclamationName || null,
        reclamation_by: reclamationBy,
        created_by: user.id,
        latitude: location.latitude,
        longitude: location.longitude,
        gps_accuracy: location.accuracy,
        media_urls: [],
        created_at: new Date().toISOString(),
        synced: 0
      };

      await db.withTransactionAsync(async () => {
        const result = await db.runAsync(
          `INSERT INTO incidents (
            client_id, type, date, village, status, incident_type, commune_id, equipment_used,
            description, reclamation, reclamation_name, reclamation_by, created_by,
            latitude, longitude, gps_accuracy, media_urls, sync_status, synced, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [
            incidentData.client_id,
            incidentData.type,
            incidentData.date,
            incidentData.village,
            incidentData.status,
            incidentData.incident_type,
            incidentData.commune_id,
            incidentData.equipment_used,
            incidentData.description,
            incidentData.reclamation,
            incidentData.reclamation_name,
            incidentData.reclamation_by,
            incidentData.created_by,
            incidentData.latitude,
            incidentData.longitude,
            incidentData.gps_accuracy,
            JSON.stringify(incidentData.media_urls),
            0,
            incidentData.created_at
          ]
        );

        await enqueueCreateIncident(db, result.lastInsertRowId, clientId);
        localIncidentId = result.lastInsertRowId;
      });

      if (selectedImages.length > 0 && localIncidentId !== null) {
        const incidentId = localIncidentId;
        try {
          const localPhotos = await Promise.all(selectedImages.map(async (uri) => {
            const clientMediaId = createMediaClientId();
            return {
              clientMediaId,
              localUri: await persistIncidentMedia(uri, clientMediaId),
            };
          }));

          await db.withTransactionAsync(async () => {
            await db.runAsync(
              'UPDATE incidents SET media_urls = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
              [JSON.stringify(localPhotos.map(photo => photo.localUri)), incidentId]
            );
            for (const photo of localPhotos) {
              await enqueueMediaUpload(db, incidentId, photo.localUri, photo.clientMediaId);
            }
          });
        } catch (mediaError) {
          mediaPreparationFailed = true;
          console.error(mediaError);
        }
      }

      Alert.alert(
        "Succès",
        mediaPreparationFailed
          ? "Incident enregistré localement. Certaines photos n'ont pas pu être préparées."
          : "Incident enregistré localement"
      );

      // Trigger sync
      syncPendingItems({ reason: 'post-create' });

      router.replace('/(tabs)/home');
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === 'LOCATION_PERMISSION_DENIED') {
        Alert.alert("Localisation requise", "Activez la localisation GPS pour enregistrer l'incident.");
      } else {
        Alert.alert("Erreur", "Impossible d'enregistrer l'incident");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const captureLocation = async (): Promise<{
    latitude: number;
    longitude: number;
    accuracy: number | null;
  }> => {
    setIsCapturingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error("LOCATION_PERMISSION_DENIED");
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
        mayShowUserSettingsDialog: true,
      });

      const nextLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };
      setGpsLocation(nextLocation);
      return nextLocation;
    } finally {
      setIsCapturingLocation(false);
    }
  };

  const createClientId = () => {
    return `incident-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const createMediaClientId = () => {
    return `media-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  // --- Metering Shared Value ---
  const metering = useSharedValue(-160);

  // --- Helpers ---
  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCancelRecording = async () => {
    debugLog("Cancelling recording...");
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
      } catch (e) { console.error(e); }
    }
    setRecording(null);
    setIsRecording(false);
    setIsProcessingAudio(false);
    setVoiceMode(false);
  };

  const renderVoiceMode = () => (
    <VoiceRecorderOverlay
      isVisible={voiceMode}
      isRecording={isRecording}
      isProcessing={isProcessingAudio}
      metering={metering}
      onStartRecording={startRecording}
      onStopRecording={stopRecording}
      onCancel={handleCancelRecording}
      durationFormatted={formatDuration(recordingDuration)}
    />
  );

  const filteredCommunes = useMemo(() => {
    const normalizedSearch = communeSearch.trim().toLowerCase();
    return communes
      .filter((c): c is Commune & { remote_id: string } => !!c.remote_id)
      .filter(c => c.name.toLowerCase().includes(normalizedSearch))
      .slice(0, 8);
  }, [communeSearch, communes]);

  const renderForm = () => (
    <ScrollView style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}>
      {/* Step 1 */}
      {currentStep === 1 && (
        <View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {["BT", "MT"].map((t) => (
              <TouchableOpacity
                key={t}
                style={{
                  flex: 1,
                  paddingVertical: 18,
                  borderRadius: 8,
                  borderWidth: 2,
                  backgroundColor: type === t ? '#DAF22C' : '#FFFFFF',
                  borderColor: type === t ? '#DAF22C' : '#D1D5DB',
                }}
                onPress={() => setType(t as "BT" | "MT")}
              >
                <Text style={{
                  textAlign: 'center',
                  fontWeight: '900',
                  fontSize: 22,
                  color: '#111827',
                  letterSpacing: 1,
                }}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Date et heure</Text>
            <TouchableOpacity
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                padding: 16,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '600', fontFamily: 'monospace' }}>{formatDate(incidentDate)}</Text>
              <View style={{ backgroundColor: '#DAF22C', padding: 6, borderRadius: 6 }}>
                <Ionicons name="calendar" size={20} color="#111827" />
              </View>
            </TouchableOpacity>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Commune</Text>
            {communes.length === 0 ? (
              <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 8, padding: 16 }}>
                <Text style={{ color: '#991B1B', fontWeight: '800' }}>Synchronisation des communes requise.</Text>
              </View>
            ) : (
              <>
                <TextInput
                  style={{
                    backgroundColor: '#FFFFFF',
                    borderRadius: 8,
                    padding: 16,
                    color: '#111827',
                    fontSize: 16,
                    fontWeight: '600',
                    borderWidth: 1,
                    borderColor: '#D1D5DB',
                    marginBottom: 8,
                  }}
                  value={communeSearch}
                  onChangeText={setCommuneSearch}
                  placeholder="Rechercher une commune"
                  placeholderTextColor="#9CA3AF"
                />
                <View style={{ gap: 8 }}>
                  {filteredCommunes.map((c) => (
                    <TouchableOpacity
                      key={c.id}
                      onPress={() => {
                        setCommune(c.remote_id);
                        setCommuneSearch(c.name);
                      }}
                      style={{
                        backgroundColor: commune === c.remote_id ? '#DAF22C' : '#FFFFFF',
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: commune === c.remote_id ? '#DAF22C' : '#D1D5DB',
                        padding: 14,
                      }}
                    >
                      <Text style={{ color: '#111827', fontWeight: '800' }}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Village</Text>
            <TextInput
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                padding: 16,
                paddingHorizontal: 16,
                color: '#111827',
                fontSize: 18,
                fontWeight: '500',
                borderWidth: 1,
                borderColor: '#D1D5DB',
              }}
              value={village}
              onChangeText={setVillage}
              placeholder="Nom du village"
              placeholderTextColor="#52525B"
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Position GPS</Text>
            <TouchableOpacity
              onPress={captureLocation}
              disabled={isCapturingLocation}
              style={{
                backgroundColor: gpsLocation ? '#F0FDF4' : '#FFFFFF',
                borderRadius: 8,
                padding: 16,
                borderWidth: 1,
                borderColor: gpsLocation ? '#86EFAC' : '#D1D5DB',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              {isCapturingLocation ? (
                <ActivityIndicator color="#111827" />
              ) : (
                <Ionicons name={gpsLocation ? "location" : "location-outline"} size={24} color={gpsLocation ? '#16A34A' : '#111827'} />
              )}
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#111827', fontWeight: '900', fontSize: 14 }}>
                  {gpsLocation ? 'POSITION CAPTURÉE' : 'CAPTURER LA POSITION'}
                </Text>
                <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 12, marginTop: 4 }}>
                  {gpsLocation
                    ? `${gpsLocation.latitude.toFixed(6)}, ${gpsLocation.longitude.toFixed(6)}${gpsLocation.accuracy ? ` • ±${Math.round(gpsLocation.accuracy)}m` : ''}`
                    : 'Obligatoire avant enregistrement'}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Step 2 */}
      {currentStep === 2 && (
        <View>
          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Type d&apos;incident</Text>
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              overflow: 'hidden',
            }}>
              <Picker
                selectedValue={incidentType}
                onValueChange={setIncidentType}
                style={{ color: '#111827', height: 56 }}
                dropdownIconColor="#DAF22C"
              >
                {getIncidentTypesForType(type).map((item) => (
                  <Picker.Item key={item} label={item} value={item} color="black" />
                ))}
              </Picker>
            </View>
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Matériel Utilisé</Text>
            <TextInput
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                padding: 16,
                paddingHorizontal: 16,
                color: '#111827',
                fontSize: 18,
                fontWeight: '500',
                borderWidth: 1,
                borderColor: '#D1D5DB',
              }}
              value={equipment}
              onChangeText={setEquipment}
              placeholder="Câble, isolateur..."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Notes</Text>
            <TextInput
              style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                padding: 16,
                color: '#111827',
                fontSize: 16,
                fontWeight: '500',
                borderWidth: 1,
                borderColor: '#D1D5DB',
                minHeight: 96,
                textAlignVertical: 'top',
              }}
              value={description}
              onChangeText={setDescription}
              placeholder="Description ou observations"
              placeholderTextColor="#9CA3AF"
              multiline
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Preuve Visuelle</Text>
            <View style={{ flexDirection: 'row', gap: 12, marginBottom: selectedImages.length > 0 ? 12 : 0 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={takePhoto}
                >
                  <Ionicons name="camera" size={32} color="#DAF22C" />
                  <Text style={{ color: '#111827', marginTop: 12, fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    backgroundColor: '#FFFFFF',
                    borderWidth: 2,
                    borderStyle: 'dashed',
                    borderColor: '#D1D5DB',
                    borderRadius: 8,
                    padding: 24,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={32} color="#DAF22C" />
                  <Text style={{ color: '#111827', marginTop: 12, fontWeight: '700', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' }}>Galerie</Text>
                </TouchableOpacity>
              </View>
            {selectedImages.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {selectedImages.map((uri) => (
                  <View key={uri} style={{ position: 'relative', marginRight: 10 }}>
                    <Image source={{ uri }} style={{ width: 116, height: 116, borderRadius: 8, backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB' }} resizeMode="cover" />
                    <TouchableOpacity
                      style={{ position: 'absolute', top: 6, right: 6, backgroundColor: '#FFFFFF', padding: 6, borderRadius: 6, borderWidth: 1, borderColor: '#D1D5DB' }}
                      onPress={() => removeImage(uri)}
                    >
                      <Ionicons name="close" size={16} color="#111827" />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>

          <View style={{ marginBottom: 24 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              padding: 20,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#D1D5DB',
            }}>
              <Text style={{ color: '#111827', fontSize: 18, fontWeight: '600' }}>RÉCLAMATION</Text>
              <TouchableOpacity onPress={() => setIsReclamation(!isReclamation)}>
                <View style={{
                  width: 60,
                  height: 34,
                  borderRadius: 4,
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                  backgroundColor: isReclamation ? '#DAF22C' : '#E5E7EB',
                }}>
                  <View style={{
                    width: 26,
                    height: 26,
                    borderRadius: 2,
                    backgroundColor: isReclamation ? '#111827' : '#9CA3AF',
                    alignSelf: isReclamation ? 'flex-end' : 'flex-start',
                  }} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {isReclamation && (
            <View style={{
              backgroundColor: '#FFFFFF',
              padding: 16,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              marginBottom: 24,
            }}>
              <Text style={{ color: '#6B7280', marginBottom: 12, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Détails Réclamation</Text>
              <TextInput
                style={{
                  backgroundColor: '#F9FAFB',
                  borderRadius: 6,
                  padding: 14,
                  color: '#111827',
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                }}
                value={reclamationName}
                onChangeText={setReclamationName}
              placeholder="Nom du réclamant"
                placeholderTextColor="#9CA3AF"
              />
              <View style={{
                backgroundColor: '#F9FAFB',
                borderRadius: 6,
                borderWidth: 1,
                borderColor: '#E5E7EB',
                overflow: 'hidden',
              }}>
                <Picker
                  selectedValue={reclamationBy}
                  onValueChange={setReclamationBy}
                  style={{ color: '#111827', height: 50 }}
                  dropdownIconColor="#DAF22C"
                >
                  <Picker.Item label="ADMINISTRATION" value="Administration" color="black" />
                  <Picker.Item label="CLIENT" value="Client" color="black" />
                </Picker>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Step 3: Verification */}
      {currentStep === 3 && (
        <View style={{
          backgroundColor: '#FFFFFF',
          padding: 24,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: '#D1D5DB',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 12 }}>
            <View style={{ width: 4, height: 24, backgroundColor: '#DAF22C' }} />
            <Text style={{ color: '#111827', fontSize: 20, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' }}>Vérification</Text>
          </View>

          {[
            { l: 'TYPE', v: type },
            { l: 'DATE', v: formatDate(incidentDate) },
            { l: 'VILLAGE', v: village },
            { l: 'COMMUNE', v: communes.find(c => c.remote_id === commune)?.name || commune },
            { l: 'INCIDENT', v: incidentType },
            { l: 'MATÉRIEL', v: equipment },
            { l: 'GPS', v: gpsLocation ? 'CAPTURÉE' : 'REQUIS' },
            { l: 'PHOTOS', v: selectedImages.length > 0 ? `${selectedImages.length}` : 'ABSENTES' }
          ].map((item, i) => (
            <View key={i} style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              marginBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F3F4F6',
              paddingBottom: 12,
            }}>
              <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>{item.l}</Text>
              <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 16, fontFamily: 'monospace' }}>{item.v}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );

  if (voiceMode) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#111827' }}>
        {renderVoiceMode()}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        marginBottom: 24,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => {
              if (currentStep > 1) setCurrentStep(currentStep - 1);
              else setVoiceMode(true);
            }}
            style={{ padding: 8, marginLeft: -8 }}
          >
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={{ alignItems: 'flex-end' }}>
            <Text style={{ fontSize: 12, fontWeight: '900', letterSpacing: 2, textTransform: 'uppercase', color: '#6B7280' }}>
              NOUVEL INCIDENT
            </Text>
            <Text style={{ color: '#111827', fontSize: 16, fontWeight: 'bold', letterSpacing: 0.5 }}>
              {currentStep === 3 ? "CONFIRMATION" : `ÉTAPE 0${currentStep} / 03`}
            </Text>
          </View>
        </View>
        {/* Progress Bar */}
        <View style={{ flexDirection: 'row', gap: 4, marginTop: 16 }}>
          {[1, 2, 3].map((step) => (
            <View
              key={step}
              style={{
                flex: 1,
                height: 4,
                backgroundColor: step <= currentStep ? '#DAF22C' : '#E5E7EB',
                borderRadius: 2
              }}
            />
          ))}
        </View>
      </View>

      {renderForm()}

      {/* Footer Navigation */}
      <View style={{ padding: 20, paddingBottom: 40, backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#DAF22C',
            paddingVertical: 18,
            borderRadius: 4,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#DAF22C'
          }}
          onPress={() => {
            if (currentStep < 3) setCurrentStep(currentStep + 1);
            else handleSubmit();
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#111827" />
          ) : (
            <Text style={{ color: '#111827', fontWeight: '900', fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase' }}>
              {currentStep === 3 ? "ENREGISTRER L'INCIDENT" : "ÉTAPE SUIVANTE"}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DateTimePicker
          value={incidentDate}
          mode="date"
          display="default"
          onChange={onDateChange}
        />
      )}
      {showTimePicker && (
        <DateTimePicker
          value={incidentDate}
          mode="time"
          display="default"
          onChange={onDateChange}
        />
      )}
    </SafeAreaView>
  );
}

function debugLog(...args: unknown[]): void {
  if (__DEV__) {
    console.log(...args);
  }
}
