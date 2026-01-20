import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import { router } from "expo-router";
import { useSQLiteContext } from 'expo-sqlite';
import React, { useEffect, useState } from "react";
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
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useSync } from '../../hooks/useSync';

// Voice processing webhook URL (Note: React Native requires EXPO_PUBLIC_ prefix)
const VOICE_WEBHOOK_URL = process.env.EXPO_PUBLIC_WEBHOOK_URL || "https://n8n.srv1078911.hstgr.cloud/webhook/2681ae8b-4c85-4522-bf61-dd51b00eb520";

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
  const [pulseAnim] = useState(new Animated.Value(1));
  const [voiceMode, setVoiceMode] = useState(true);

  // UI State
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

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
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
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

      // Upload audio to webhook
      const formData = new FormData();
      formData.append('audio', {
        uri: uri,
        type: 'audio/m4a',
        name: `recording_${Date.now()}.m4a`,
      } as any);
      formData.append('user_id', user?.id || 'unknown');
      formData.append('timestamp', new Date().toISOString());

      const response = await fetch(VOICE_WEBHOOK_URL, {
        method: 'POST',
        body: formData,
        headers: {
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();

      // Handle n8n response format: [{ output: {...} }] or { success, data }
      let data = null;
      if (Array.isArray(result) && result.length > 0 && result[0].output) {
        // n8n format: [{ output: {...} }]
        data = result[0].output;
      } else if (result.success && result.data) {
        // Standard format: { success, data }
        data = result.data;
      } else if (result.output) {
        // Direct format: { output: {...} }
        data = result.output;
      }

      if (data) {
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
          // Could use incident_type to help with equipment if empty
          if (!data.equipment_used || data.equipment_used.trim() === '') {
            setEquipment(data.incident_type);
            console.log('Using incident_type as equipment:', data.incident_type);
          }
        }
        if (data.reclamation === true || data.reclamation === false) {
          console.log('Setting reclamation:', data.reclamation);
          setIsReclamation(data.reclamation);
        }
        if (data.is_reclamation === true || data.is_reclamation === false) {
          console.log('Setting is_reclamation:', data.is_reclamation);
          setIsReclamation(data.is_reclamation);
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
      } else {
        Alert.alert(
          "Erreur de Traitement",
          result.error || "Impossible d'extraire les informations de l'audio."
        );
      }
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

  const renderVoiceMode = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#191820' }}>
      <View style={{ marginBottom: 40, alignItems: 'center' }}>
        <Text style={{ color: 'white', fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>
          {isProcessingAudio ? 'Traitement en cours...' : 'Signaler un Incident'}
        </Text>
        <Text style={{ color: '#9CA3AF', fontSize: 18 }}>
          {isProcessingAudio ? 'Analyse de votre enregistrement' : isRecording ? 'Enregistrement...' : 'Appuyez pour parler'}
        </Text>
      </View>

      {isProcessingAudio ? (
        <View style={{
          width: 160,
          height: 160,
          borderRadius: 80,
          backgroundColor: 'rgba(218, 242, 44, 0.2)',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <ActivityIndicator size={60} color="#DAF22C" />
        </View>
      ) : (
        <TouchableOpacity
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.8}
          disabled={isProcessingAudio}
        >
          <Animated.View
            style={{
              transform: [{ scale: pulseAnim }],
              width: 160,
              height: 160,
              borderRadius: 80,
              backgroundColor: '#DAF22C',
              justifyContent: 'center',
              alignItems: 'center',
              shadowColor: '#DAF22C',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <Ionicons name={isRecording ? "stop" : "mic"} size={60} color="#191820" />
          </Animated.View>
        </TouchableOpacity>
      )}

      {isRecording && !isProcessingAudio && (
        <View style={{ marginTop: 32, flexDirection: 'row', gap: 4, height: 40, alignItems: 'center' }}>
          <View style={{ width: 8, height: 16, backgroundColor: '#DAF22C', borderRadius: 4 }} />
          <View style={{ width: 8, height: 32, backgroundColor: '#DAF22C', borderRadius: 4 }} />
          <View style={{ width: 8, height: 16, backgroundColor: '#DAF22C', borderRadius: 4 }} />
        </View>
      )}

      <TouchableOpacity
        style={{
          marginTop: 80,
          backgroundColor: isProcessingAudio ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.1)',
          paddingHorizontal: 32,
          paddingVertical: 16,
          borderRadius: 50
        }}
        onPress={() => setVoiceMode(false)}
        disabled={isProcessingAudio}
      >
        <Text style={{ color: isProcessingAudio ? '#666' : 'white', fontWeight: 'bold', fontSize: 18 }}>
          Saisie Manuelle
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderForm = () => (
    <ScrollView className="flex-1 px-4 pt-4">
      {/* Step 1 */}
      {currentStep === 1 && (
        <View>
          <View className="flex-row gap-x-2 mb-6">
            {["BT", "MT"].map((t) => (
              <TouchableOpacity
                key={t}
                className={`flex-1 py-4 rounded-xl border-2 ${type === t ? "bg-[#DAF22C] border-[#DAF22C]" : "bg-[#191820] border-gray-700"}`}
                onPress={() => setType(t as "BT" | "MT")}
              >
                <Text className={`text-center font-bold text-xl ${type === t ? "text-[#191820]" : "text-white"}`}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="mb-5">
            <Text className="text-gray-500 mb-2 font-bold uppercase text-xs">Date</Text>
            <TouchableOpacity
              className="bg-[#191820] rounded-xl p-4 border border-gray-700 flex-row justify-between items-center"
              onPress={() => setShowDatePicker(true)}
            >
              <Text className="text-white text-lg font-medium">{formatDate(incidentDate)}</Text>
              <Ionicons name="calendar" size={24} color="#DAF22C" />
            </TouchableOpacity>
          </View>

          <View className="mb-5">
            <Text className="text-gray-500 mb-2 font-bold uppercase text-xs">Commune</Text>
            <View className="bg-[#191820] rounded-xl border border-gray-700 overflow-hidden">
              <Picker
                selectedValue={commune}
                onValueChange={setCommune}
                style={{ color: 'white' }}
                dropdownIconColor="#DAF22C"
              >
                <Picker.Item label="Sélectionner une commune" value="" color="#999" />
                {communes.map((c) => (
                  <Picker.Item key={c.id} label={c.name} value={c.remote_id} color="black" />
                ))}
              </Picker>
            </View>
          </View>

          <View className="mb-5">
            <Text className="text-gray-500 mb-2 font-bold uppercase text-xs">Village</Text>
            <TextInput
              className="bg-[#191820] rounded-xl p-4 text-white text-lg border border-gray-700"
              value={village}
              onChangeText={setVillage}
              placeholder="Nom du village"
              placeholderTextColor="#666"
            />
          </View>
        </View>
      )}

      {/* Step 2 */}
      {currentStep === 2 && (
        <View>
          <View className="mb-5">
            <Text className="text-gray-500 mb-2 font-bold uppercase text-xs">Matériel Utilisé</Text>
            <TextInput
              className="bg-[#191820] rounded-xl p-4 text-white text-lg border border-gray-700"
              value={equipment}
              onChangeText={setEquipment}
              placeholder="Câble, Isolateur..."
              placeholderTextColor="#666"
            />
          </View>

          <View className="mb-5">
            <Text className="text-gray-500 mb-2 font-bold uppercase text-xs">Photo</Text>
            {selectedImage ? (
              <View className="relative">
                <Image source={{ uri: selectedImage }} className="w-full h-48 rounded-xl bg-gray-800" resizeMode="cover" />
                <TouchableOpacity
                  className="absolute top-2 right-2 bg-black/50 p-2 rounded-full"
                  onPress={() => setSelectedImage(null)}
                >
                  <Ionicons name="close" size={20} color="white" />
                </TouchableOpacity>
              </View>
            ) : (
              <View className="flex-row gap-x-3">
                <TouchableOpacity
                  className="flex-1 bg-[#191820] border-2 border-dashed border-gray-700 rounded-xl p-6 items-center justify-center"
                  onPress={takePhoto}
                >
                  <Ionicons name="camera" size={32} color="#DAF22C" />
                  <Text className="text-white mt-2 font-medium">Caméra</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-[#191820] border-2 border-dashed border-gray-700 rounded-xl p-6 items-center justify-center"
                  onPress={pickImage}
                >
                  <Ionicons name="images" size={32} color="#DAF22C" />
                  <Text className="text-white mt-2 font-medium">Galerie</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View className="mb-5">
            <View className="flex-row justify-between items-center bg-[#191820] p-4 rounded-xl border border-gray-700">
              <Text className="text-white text-lg font-medium">Réclamation ?</Text>
              <TouchableOpacity onPress={() => setIsReclamation(!isReclamation)}>
                <View className={`w-14 h-8 rounded-full justify-center px-1 ${isReclamation ? 'bg-[#DAF22C]' : 'bg-gray-600'}`}>
                  <View className={`w-6 h-6 rounded-full bg-white ${isReclamation ? 'self-end' : 'self-start'}`} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {isReclamation && (
            <View className="bg-[#191820] p-4 rounded-xl border border-gray-700 mb-5">
              <Text className="text-gray-500 mb-2 font-bold uppercase text-xs">Détails Réclamation</Text>
              <TextInput
                className="bg-black/20 rounded-lg p-3 text-white mb-3 border border-gray-600"
                value={reclamationName}
                onChangeText={setReclamationName}
                placeholder="Nom du réclamant"
                placeholderTextColor="#666"
              />
              <Picker
                selectedValue={reclamationBy}
                onValueChange={setReclamationBy}
                style={{ color: 'white' }}
                dropdownIconColor="#DAF22C"
              >
                <Picker.Item label="Administration" value="Administration" color="black" />
                <Picker.Item label="Client" value="Client" color="black" />
              </Picker>
            </View>
          )}
        </View>
      )}

      {/* Step 3: Verification */}
      {currentStep === 3 && (
        <View className="bg-[#191820] p-6 rounded-xl border border-gray-700">
          <Text className="text-[#DAF22C] text-xl font-bold mb-6">Vérification</Text>
          {[
            { l: 'Type', v: type },
            { l: 'Date', v: formatDate(incidentDate) },
            { l: 'Village', v: village },
            { l: 'Commune', v: communes.find(c => c.remote_id === commune)?.name || commune },
            { l: 'Équipement', v: equipment },
            { l: 'Photo', v: selectedImage ? 'Oui' : 'Non' }
          ].map((item, i) => (
            <View key={i} className="flex-row justify-between mb-4 border-b border-gray-800 pb-2">
              <Text className="text-gray-400">{item.l}</Text>
              <Text className="text-white font-bold">{item.v}</Text>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{
        backgroundColor: '#191820',
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 24,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 12,
      }}>
        <View className="flex-row justify-between items-center">
          <TouchableOpacity onPress={() => {
            if (currentStep > 1) setCurrentStep(currentStep - 1);
            else setVoiceMode(true);
          }}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text className="text-white text-xl font-bold">
            {currentStep === 3 ? "Confirmation" : `Étape ${currentStep}/3`}
          </Text>
          <View className="w-6" />
        </View>
      </View>

      {renderForm()}

      {/* Footer Navigation */}
      <View style={{ padding: 16, paddingBottom: 100, backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
        <TouchableOpacity
          style={{
            backgroundColor: '#DAF22C',
            paddingVertical: 16,
            borderRadius: 12,
            alignItems: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
            elevation: 6,
          }}
          onPress={() => {
            if (currentStep < 3) setCurrentStep(currentStep + 1);
            else handleSubmit();
          }}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#191820" />
          ) : (
            <Text className="text-[#191820] font-bold text-lg">
              {currentStep === 3 ? "ENREGISTRER" : "SUIVANT"}
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
