import VoiceRecorderOverlay from "@/components/VoiceRecorderOverlay";
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useState } from "react";
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
import { useSync } from '../../hooks/useSync';
import { processVoiceRecording } from '../../lib/voice-processing';

// Defines
interface Commune {
  id: number;
  name: string;
  remote_id: string;
}

export default function CreateIncidentScreen() {
  const { user } = useAuth();
  const db = useSQLiteContext();
  const { syncPendingItems } = useSync();

  // Form State
  const [type, setType] = useState<"BT" | "MT">("BT");
  const [incidentDate, setIncidentDate] = useState(new Date());
  const [commune, setCommune] = useState(""); // Stores remote_id or ID? Let's store ID or remote_id. The DB schema uses text commune_id.
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [village, setVillage] = useState("");
  const [equipment, setEquipment] = useState("");
  const [isReclamation, setIsReclamation] = useState(false);
  const [reclamationName, setReclamationName] = useState("");
  const [reclamationBy, setReclamationBy] = useState("Administration");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Voice State
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [voiceMode, setVoiceMode] = useState(true);

  // UI State
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
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
      setVillage("");
      setEquipment("");
      setIsReclamation(false);
      setReclamationName("");
      setReclamationBy("Administration");
      setSelectedImage(null);
      setVoiceMode(true);
      setRecordingDuration(0);
    }, [])
  );

  // Load Communes
  useEffect(() => {
    const loadCommunes = async () => {
      try {
        const rows = await db.getAllAsync<Commune>('SELECT * FROM communes');
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
  }, [isRecording]);

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

      // Debug: Log what we received
      console.log('=== Voice AI Response ===');
      console.log('Full data:', JSON.stringify(data, null, 2));

      // Pre-fill form with extracted data
      if (data.type && (data.type === 'BT' || data.type === 'MT')) {
        console.log('Setting type:', data.type);
        setType(data.type);
      }
      if (data.village) {
        console.log('Setting village:', data.village);
        setVillage(data.village);
      }
      if (data.commune_id) {
        console.log('Setting commune:', data.commune_id);
        setCommune(data.commune_id);
      }
      if (data.equipment_used && data.equipment_used.trim() !== '') {
        console.log('Setting equipment:', data.equipment_used);
        setEquipment(data.equipment_used);
      }
      if (data.incident_type) {
        console.log('Incident type from AI:', data.incident_type);
        // Use incident_type as equipment if empty
        if (!data.equipment_used || data.equipment_used.trim() === '') {
          setEquipment(data.incident_type);
          console.log('Using incident_type as equipment:', data.incident_type);
        }
      }
      if (data.reclamation === true || data.reclamation === false) {
        console.log('Setting reclamation:', data.reclamation);
        setIsReclamation(data.reclamation);
      }
      if (data.reclamation_name) {
        console.log('Setting reclamation_name:', data.reclamation_name);
        setReclamationName(data.reclamation_name);
      }
      if (data.reclamation_by) {
        console.log('Setting reclamation_by:', data.reclamation_by);
        setReclamationBy(data.reclamation_by);
      }
      if (data.date) {
        try {
          const parsedDate = new Date(data.date);
          console.log('Setting date:', parsedDate);
          setIncidentDate(parsedDate);
        } catch (e) {
          console.log('Could not parse date:', data.date);
        }
      }

      console.log('=== Form Fill Complete ===');

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

  const onDateChange = (event: any, selectedDate?: Date) => {
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
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) setSelectedImage(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!commune || !village || !equipment) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      setIsSubmitting(true);
      const incidentData = {
        type,
        date: incidentDate.toISOString(),
        village,
        status: 'open',
        incident_type: 'General', // Default
        commune_id: commune,
        equipment_used: equipment,
        reclamation: isReclamation ? 1 : 0,
        reclamation_name: reclamationName || null,
        reclamation_by: reclamationBy,
        created_by: user?.id || 'unknown',
        created_at: new Date().toISOString(),
        synced: 0
      };

      // 1. Insert into incidents
      const result = await db.runAsync(
        `INSERT INTO incidents (type, date, village, status, incident_type, commune_id, equipment_used, reclamation, reclamation_name, reclamation_by, created_by, synced, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          incidentData.type,
          incidentData.date,
          incidentData.village,
          incidentData.status,
          incidentData.incident_type,
          incidentData.commune_id,
          incidentData.equipment_used,
          incidentData.reclamation,
          incidentData.reclamation_name,
          incidentData.reclamation_by,
          incidentData.created_by,
          0, // synced = false
          incidentData.created_at
        ]
      );

      // 2. Add sync action (optional if we had a robust queued system, but syncing usually checks 'synced=0')
      // For now, syncing logic in 'useSync' likely queries un-synced items.

      Alert.alert("Succès", "Incident enregistré localement");

      // Trigger sync
      syncPendingItems();

      router.replace('/(tabs)/home');
    } catch (error) {
      console.error(error);
      Alert.alert("Erreur", "Failed to save incident");
    } finally {
      setIsSubmitting(false);
    }
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
    console.log("Cancelling recording...");
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
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Date & Time</Text>
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
            <View style={{
              backgroundColor: '#FFFFFF',
              borderRadius: 8,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              overflow: 'hidden',
            }}>
              <Picker
                selectedValue={commune}
                onValueChange={setCommune}
                style={{ color: '#111827', height: 56 }}
                dropdownIconColor="#DAF22C"
              >
                <Picker.Item label="SÉLECTIONNER UNE COMMUNE" value="" color="#9CA3AF" style={{ fontSize: 14 }} />
                {communes.map((c) => (
                  <Picker.Item key={c.id} label={c.name} value={c.remote_id} color="black" />
                ))}
              </Picker>
            </View>
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
                fontWeight: '600',
                borderWidth: 1,
                borderColor: '#D1D5DB',
              }}
              value={village}
              onChangeText={setVillage}
              placeholder="NOM DU VILLAGE"
              placeholderTextColor="#52525B"
            />
          </View>
        </View>
      )}

      {/* Step 2 */}
      {currentStep === 2 && (
        <View>
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
                fontWeight: '600',
                borderWidth: 1,
                borderColor: '#D1D5DB',
              }}
              value={equipment}
              onChangeText={setEquipment}
              placeholder="CÂBLE, ISOLATEUR..."
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Preuve Visuelle</Text>
            {selectedImage ? (
              <View style={{ position: 'relative' }}>
                <Image source={{ uri: selectedImage }} style={{ width: '100%', height: 220, borderRadius: 8, backgroundColor: '#E5E7EB', borderWidth: 1, borderColor: '#D1D5DB' }} resizeMode="cover" />
                <TouchableOpacity
                  style={{ position: 'absolute', top: 12, right: 12, backgroundColor: 'white', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB' }}
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close" size={20} color="#111827" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', gap: 12 }}>
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
                placeholder="NOM DU RÉCLAMANT"
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
            { l: 'MATÉRIEL', v: equipment },
            { l: 'PHOTO', v: selectedImage ? 'PRÉSENTE' : 'ABSENTE' }
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#191820' }}>
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
