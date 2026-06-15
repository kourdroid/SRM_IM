import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { Picker } from "@react-native-picker/picker";
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from 'expo-sqlite';
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { insertIncidentMaterials } from '../../db/incidentMaterials';
import {
  getActiveDepartHtaOptions,
  getAllActiveIncidentTypes,
  type DepartHtaOptionRow,
  type IncidentTypeOptionRow,
} from '../../db/referenceOptions';
import { enqueueCreateIncident, enqueueMediaUpload, enqueueSyncMaterials } from '../../db/syncOperations';
import { useSync } from '../../hooks/useSync';
import { persistIncidentMedia } from '../../lib/imageUtils';
import {
  buildEquipmentSummary,
  createEmptyMaterialFormRow,
  normalizeMaterialRows,
  type MaterialFormRow,
} from '../../lib/materials';

// Defines
const MAX_INCIDENT_PHOTOS = 5;
const pickerTextStyle = { color: '#111827', backgroundColor: '#FFFFFF' };

interface Commune {
  id: number;
  name: string;
  remote_id: string | null;
}

export default function CreateIncidentScreen() {
  const { user } = useAuth();
  const db = useSQLiteContext();
  const { syncPendingItems } = useSync(user?.id);
  const formScrollRef = useRef<ScrollView>(null);

  // Form State
  const [type, setType] = useState<"BT" | "MT">("BT");
  const [incidentDate, setIncidentDate] = useState(new Date());
  const [commune, setCommune] = useState("");
  const [communeSearch, setCommuneSearch] = useState("");
  const [communes, setCommunes] = useState<Commune[]>([]);
  const [village, setVillage] = useState("");
  const [incidentType, setIncidentType] = useState<string>("");
  const [departHta, setDepartHta] = useState("");
  const [incidentTypeOptions, setIncidentTypeOptions] = useState<IncidentTypeOptionRow[]>([]);
  const [departHtaOptions, setDepartHtaOptions] = useState<DepartHtaOptionRow[]>([]);
  const [referencesLoading, setReferencesLoading] = useState(true);
  const [materialRows, setMaterialRows] = useState<MaterialFormRow[]>([createEmptyMaterialFormRow()]);
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

  // UI State
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const incidentTypes = useMemo(
    () => incidentTypeOptions
      .filter(option => option.network_type === type)
      .map(option => option.name),
    [incidentTypeOptions, type]
  );
  const safeIncidentType = useMemo(
    () => resolveIncidentType(incidentTypes, incidentType),
    [incidentTypes, incidentType]
  );
  const hasRequiredReferenceData = incidentTypes.length > 0 && (type !== 'MT' || departHtaOptions.length > 0);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      formScrollRef.current?.scrollTo({ y: 0, animated: false });
    }, 0);
    return () => clearTimeout(timeoutId);
  }, [currentStep]);

  const loadFieldReferences = useCallback(async () => {
    setReferencesLoading(true);
    try {
      const [communeRows, incidentTypeRows, departRows] = await Promise.all([
        db.getAllAsync<Commune>('SELECT * FROM communes ORDER BY name ASC'),
        getAllActiveIncidentTypes(db),
        getActiveDepartHtaOptions(db),
      ]);
      setCommunes(communeRows);
      setIncidentTypeOptions(incidentTypeRows);
      setDepartHtaOptions(departRows);
    } catch (e) {
      console.error("Failed to load field references", e);
    } finally {
      setReferencesLoading(false);
    }
  }, [db]);

  // Reset form every time the screen gains focus (tab switching preserves state)
  useFocusEffect(
    useCallback(() => {
      void loadFieldReferences();
      setCurrentStep(1);
      setType("BT");
      setIncidentDate(new Date());
      setCommune("");
      setCommuneSearch("");
      setVillage("");
      setIncidentType("");
      setDepartHta("");
      setMaterialRows([createEmptyMaterialFormRow()]);
      setDescription("");
      setIsReclamation(false);
      setReclamationName("");
      setReclamationBy("Administration");
      setSelectedImages([]);
      setGpsLocation(null);
    }, [loadFieldReferences])
  );

  useEffect(() => {
    if (incidentType !== safeIncidentType) {
      setIncidentType(safeIncidentType);
    }
    if (type !== 'MT') {
      setDepartHta("");
    } else if (departHta && !departHtaOptions.some(option => option.name === departHta)) {
      setDepartHta("");
    }
  }, [type, incidentType, safeIncidentType, departHta, departHtaOptions]);

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
    if (selectedImages.length >= MAX_INCIDENT_PHOTOS) {
      Alert.alert("Limite atteinte", `Maximum ${MAX_INCIDENT_PHOTOS} photos par incident.`);
      return;
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: MAX_INCIDENT_PHOTOS - selectedImages.length,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setSelectedImages(prev => [...prev, ...result.assets.map(asset => asset.uri)].slice(0, MAX_INCIDENT_PHOTOS));
    }
  };

  const takePhoto = async () => {
    if (selectedImages.length >= MAX_INCIDENT_PHOTOS) {
      Alert.alert("Limite atteinte", `Maximum ${MAX_INCIDENT_PHOTOS} photos par incident.`);
      return;
    }
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

    if (!hasRequiredReferenceData) {
      Alert.alert("Synchronisation requise", "Synchronisez les types d'incidents et les départs HTA avant de créer un incident.");
      return;
    }

    const normalizedMaterials = normalizeMaterialRows(materialRows);
    if (!commune || !village || !safeIncidentType) {
      Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires");
      return;
    }

    if (normalizedMaterials === null) {
      Alert.alert("Matériel invalide", "Chaque ligne de matériel doit avoir un nom et une quantité positive.");
      return;
    }

    if (type === 'MT' && !departHta) {
      Alert.alert("Départ HTA requis", "Veuillez sélectionner le départ HTA pour un incident MT.");
      return;
    }

    try {
      setIsSubmitting(true);
      const location = gpsLocation || await captureLocation();
      const clientId = createClientId();
      const equipmentSummary = buildEquipmentSummary(normalizedMaterials);
      let localIncidentId: number | null = null;
      let mediaPreparationFailed = false;

      const incidentData = {
        client_id: clientId,
        type,
        date: incidentDate.toISOString(),
        village,
        status: 'open',
        incident_type: safeIncidentType,
        depart_hta: type === 'MT' ? departHta : null,
        commune_id: commune,
        equipment_used: equipmentSummary,
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
            client_id, type, date, village, status, incident_type, depart_hta, commune_id, equipment_used,
            description, reclamation, reclamation_name, reclamation_by, created_by,
            latitude, longitude, gps_accuracy, media_urls, sync_status, synced, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
          [
            incidentData.client_id,
            incidentData.type,
            incidentData.date,
            incidentData.village,
            incidentData.status,
            incidentData.incident_type,
            incidentData.depart_hta,
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
        if (normalizedMaterials.length > 0) {
          await insertIncidentMaterials(db, result.lastInsertRowId, normalizedMaterials);
          await enqueueSyncMaterials(db, result.lastInsertRowId);
        }
        localIncidentId = result.lastInsertRowId;
      });

      if (selectedImages.length > 0 && localIncidentId !== null) {
        const incidentId = localIncidentId;
        try {
          const localPhotos: { clientMediaId: string; localUri: string }[] = [];
          for (const uri of selectedImages) {
            const clientMediaId = createMediaClientId();
            localPhotos.push({
              clientMediaId,
              localUri: await persistIncidentMedia(uri, clientMediaId),
            });
          }

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

  const addMaterialRow = () => {
    setMaterialRows(rows => [...rows, createEmptyMaterialFormRow()]);
  };

  const removeMaterialRow = (id: string) => {
    setMaterialRows(rows => rows.length > 1 ? rows.filter(row => row.id !== id) : rows);
  };

  const updateMaterialRow = (id: string, patch: Partial<MaterialFormRow>) => {
    setMaterialRows(rows => rows.map(row => row.id === id ? { ...row, ...patch } : row));
  };

  const handleTypeChange = (nextType: "BT" | "MT") => {
    setType(nextType);
    const nextOptions = incidentTypeOptions
      .filter(option => option.network_type === nextType)
      .map(option => option.name);
    setIncidentType(current => resolveIncidentType(nextOptions, current));
    if (nextType !== 'MT') {
      setDepartHta("");
    }
  };

  const selectedCommuneName = useMemo(
    () => communes.find(c => c.remote_id === commune)?.name || '',
    [commune, communes]
  );

  const handleCommuneSearchChange = (value: string) => {
    setCommuneSearch(value);
    if (value !== selectedCommuneName) {
      setCommune("");
    }
  };

  const filteredCommunes = useMemo(() => {
    const normalizedSearch = communeSearch.trim().toLowerCase();
    if (normalizedSearch.length < 2 || communeSearch === selectedCommuneName) {
      return [];
    }

    return communes
      .filter((c): c is Commune & { remote_id: string } => !!c.remote_id)
      .filter(c => c.name.toLowerCase().includes(normalizedSearch))
      .slice(0, 8);
  }, [communeSearch, communes, selectedCommuneName]);

  const canAdvance = useMemo(() => {
    if (referencesLoading) return false;
    if (currentStep === 1) {
      return communes.some(item => item.remote_id) && incidentTypes.length > 0;
    }
    if (currentStep === 2) {
      return incidentTypes.length > 0 && (type !== 'MT' || departHtaOptions.length > 0);
    }
    return true;
  }, [communes, currentStep, departHtaOptions.length, incidentTypes.length, referencesLoading, type]);

  const renderForm = () => (
    <ScrollView
      ref={formScrollRef}
      style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16 }}
      contentContainerStyle={{ paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Step 1 */}
      {currentStep === 1 && (
        <View>
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
            {(["BT", "MT"] as const).map((t) => {
              const selected = type === t;
              const accent = t === 'BT' ? '#2563EB' : '#EA580C';
              const tint = t === 'BT' ? '#EFF6FF' : '#FFF7ED';
              const subtitle = t === 'BT' ? 'Basse tension' : 'Moyenne tension';
              return (
              <TouchableOpacity
                key={t}
                style={{
                  flex: 1,
                  minHeight: 92,
                  padding: 14,
                  borderRadius: 8,
                  borderWidth: 2,
                  backgroundColor: selected ? tint : '#FFFFFF',
                  borderColor: selected ? accent : '#D1D5DB',
                  justifyContent: 'space-between',
                }}
                onPress={() => handleTypeChange(t)}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: accent, fontWeight: '900', fontSize: 12 }}>{subtitle}</Text>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={accent} /> : null}
                </View>
                <Text style={{
                  fontWeight: '900',
                  fontSize: 26,
                  color: '#111827',
                  letterSpacing: 1,
                }}>{t}</Text>
              </TouchableOpacity>
              );
            })}
          </View>

          {!referencesLoading && incidentTypes.length === 0 ? (
            <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 24 }}>
              <Text style={{ color: '#991B1B', fontWeight: '900' }}>SYNCHRONISATION REQUISE</Text>
              <Text style={{ color: '#7F1D1D', fontWeight: '600', marginTop: 4 }}>
                Aucun type d&apos;incident {type} n&apos;est disponible sur cet appareil.
              </Text>
            </View>
          ) : null}

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
                  onChangeText={handleCommuneSearchChange}
                  placeholder="Tapez au moins 2 lettres"
                  placeholderTextColor="#9CA3AF"
                />
                {communeSearch.trim().length > 0 && communeSearch.trim().length < 2 ? (
                  <Text style={{ color: '#6B7280', fontSize: 12, fontWeight: '700', marginTop: 4 }}>
                    Continuez à taper pour rechercher.
                  </Text>
                ) : null}
                {communeSearch.trim().length >= 2 && filteredCommunes.length === 0 && !commune ? (
                  <View style={{ backgroundColor: '#F9FAFB', borderColor: '#E5E7EB', borderWidth: 1, borderRadius: 8, padding: 14 }}>
                    <Text style={{ color: '#6B7280', fontWeight: '700' }}>Aucune commune trouvée.</Text>
                  </View>
                ) : null}
                {filteredCommunes.length > 0 ? (
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
                ) : null}
                {commune ? (
                  <View style={{ backgroundColor: '#F0FDF4', borderColor: '#86EFAC', borderWidth: 1, borderRadius: 8, padding: 12, marginTop: 8 }}>
                    <Text style={{ color: '#166534', fontWeight: '900' }}>COMMUNE SÉLECTIONNÉE</Text>
                    <Text style={{ color: '#111827', fontWeight: '800', marginTop: 3 }}>{selectedCommuneName}</Text>
                  </View>
                ) : null}
              </>
            )}
          </View>

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Quartier/Village</Text>
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
              placeholder="Nom du quartier ou village"
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
          {!hasRequiredReferenceData ? (
            <View style={{ backgroundColor: '#FEF2F2', borderColor: '#FCA5A5', borderWidth: 1, borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <Text style={{ color: '#991B1B', fontWeight: '900' }}>SYNCHRONISATION REQUISE</Text>
              <Text style={{ color: '#7F1D1D', fontWeight: '600', marginTop: 4 }}>
                Les types d&apos;incidents{type === 'MT' ? ' et les départs HTA' : ''} doivent être synchronisés avant la saisie.
              </Text>
            </View>
          ) : null}
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
                selectedValue={safeIncidentType}
                onValueChange={setIncidentType}
                enabled={incidentTypes.length > 0}
                mode="dropdown"
                style={{ color: '#111827', backgroundColor: '#FFFFFF', height: 56 }}
                dropdownIconColor="#DAF22C"
                dropdownIconRippleColor="#E5E7EB"
              >
                {incidentTypes.length === 0 ? (
                  <Picker.Item label="Synchronisation requise" value="" color="#111827" style={pickerTextStyle} />
                ) : null}
                {incidentTypes.map((item) => (
                  <Picker.Item key={item} label={item} value={item} color="#111827" style={pickerTextStyle} />
                ))}
              </Picker>
            </View>
          </View>

          {type === 'MT' && (
            <View style={{ marginBottom: 24 }}>
              <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Départ HTA</Text>
              <View style={{
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#D1D5DB',
                overflow: 'hidden',
              }}>
                <Picker
                  selectedValue={departHta}
                  onValueChange={setDepartHta}
                  enabled={departHtaOptions.length > 0}
                  mode="dropdown"
                  style={{ color: '#111827', backgroundColor: '#FFFFFF', height: 56 }}
                  dropdownIconColor="#DAF22C"
                  dropdownIconRippleColor="#E5E7EB"
                >
                  <Picker.Item label="Sélectionner un départ HTA" value="" color="#111827" style={pickerTextStyle} />
                  {departHtaOptions.map((item) => (
                    <Picker.Item key={item.remote_id} label={item.name} value={item.name} color="#111827" style={pickerTextStyle} />
                  ))}
                </Picker>
              </View>
            </View>
          )}

          <View style={{ marginBottom: 24 }}>
            <Text style={{ color: '#6B7280', marginBottom: 8, fontWeight: '800', textTransform: 'uppercase', fontSize: 11, letterSpacing: 1.5 }}>Matériel utilisé</Text>
            <Text style={{ color: '#6B7280', fontWeight: '600', fontSize: 12, marginBottom: 10 }}>
              Optionnel à l&apos;ouverture. Obligatoire à la clôture.
            </Text>
            <View style={{ gap: 10 }}>
              {materialRows.map((row, index) => (
                <View key={row.id} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 8,
                      padding: 14,
                      color: '#111827',
                      fontSize: 16,
                      fontWeight: '600',
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                    }}
                    value={row.materialName}
                    onChangeText={(value) => updateMaterialRow(row.id, { materialName: value })}
                    placeholder={index === 0 ? "Matériel" : "Autre matériel"}
                    placeholderTextColor="#9CA3AF"
                  />
                  <TextInput
                    style={{
                      width: 92,
                      backgroundColor: '#FFFFFF',
                      borderRadius: 8,
                      padding: 14,
                      color: '#111827',
                      fontSize: 16,
                      fontWeight: '800',
                      borderWidth: 1,
                      borderColor: '#D1D5DB',
                      textAlign: 'center',
                    }}
                    value={row.quantity}
                    onChangeText={(value) => updateMaterialRow(row.id, { quantity: value })}
                    placeholder="Qté"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="decimal-pad"
                  />
                  {materialRows.length > 1 ? (
                    <TouchableOpacity
                      onPress={() => removeMaterialRow(row.id)}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: '#FCA5A5',
                        backgroundColor: '#FEF2F2',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#991B1B" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))}
              <TouchableOpacity
                onPress={addMaterialRow}
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderRadius: 8,
                  backgroundColor: '#FFFFFF',
                  borderWidth: 1,
                  borderColor: '#D1D5DB',
                }}
              >
                <Ionicons name="add" size={18} color="#111827" />
                <Text style={{ color: '#111827', fontWeight: '900' }}>Ajouter un matériel</Text>
              </TouchableOpacity>
            </View>
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
                  mode="dropdown"
                  style={{ color: '#111827', backgroundColor: '#FFFFFF', height: 50 }}
                  dropdownIconColor="#DAF22C"
                  dropdownIconRippleColor="#E5E7EB"
                >
                  <Picker.Item label="ADMINISTRATION" value="Administration" color="#111827" style={pickerTextStyle} />
                  <Picker.Item label="CLIENT" value="Client" color="#111827" style={pickerTextStyle} />
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
            { l: 'QUARTIER/VILLAGE', v: village },
            { l: 'COMMUNE', v: communes.find(c => c.remote_id === commune)?.name || commune },
            { l: 'INCIDENT', v: safeIncidentType },
            ...(type === 'MT' ? [{ l: 'DÉPART HTA', v: departHta || 'REQUIS' }] : []),
            { l: 'MATÉRIEL', v: buildEquipmentSummary(normalizeMaterialRows(materialRows) || []) || 'À LA CLÔTURE' },
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
              else router.back();
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
            backgroundColor: isSubmitting || !canAdvance ? '#E5E7EB' : '#DAF22C',
            paddingVertical: 18,
            borderRadius: 4,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: isSubmitting || !canAdvance ? '#D1D5DB' : '#DAF22C'
          }}
          onPress={() => {
            if (!canAdvance) {
              Alert.alert('Synchronisation requise', 'Synchronisez les données de référence avant de continuer.');
              return;
            }
            if (currentStep < 3) setCurrentStep(currentStep + 1);
            else handleSubmit();
          }}
          disabled={isSubmitting || !canAdvance}
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

function resolveIncidentType(options: string[], currentIncidentType: string): string {
  return options.includes(currentIncidentType)
    ? currentIncidentType
    : options[0] || '';
}
