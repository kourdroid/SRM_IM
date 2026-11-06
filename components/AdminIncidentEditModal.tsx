import { supabase } from '@/lib/supabase';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '@/src/core/constants/theme';
import { IncidentAdminService, type Incident } from '@/src/core/services/incidentAdminService';
import { DepartHtaAdminService, IncidentTypeAdminService } from '@/src/core/services/referenceAdminService';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export type IncidentEditPatch = Pick<
  Incident,
  'incident_type' | 'depart_hta' | 'commune_id' | 'commune_name' | 'village' | 'description' | 'reclamation' | 'reclamation_name' | 'reclamation_by'
>;

interface Props {
  incident: Incident | null;
  onClose: () => void;
  onSaved: (id: string, patch: IncidentEditPatch) => void;
}

export default function AdminIncidentEditModal({ incident, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [communes, setCommunes] = useState<{ id: string; name: string }[]>([]);
  const [typeNames, setTypeNames] = useState<string[]>([]);
  const [departNames, setDepartNames] = useState<string[]>([]);

  const [incidentType, setIncidentType] = useState('');
  const [departHta, setDepartHta] = useState('');
  const [communeId, setCommuneId] = useState('');
  const [village, setVillage] = useState('');
  const [description, setDescription] = useState('');
  const [reclamation, setReclamation] = useState(false);
  const [reclamationName, setReclamationName] = useState('');
  const [reclamationBy, setReclamationBy] = useState('');

  const incidentId = incident?.id;

  useEffect(() => {
    if (!incident) return;
    setIncidentType(incident.incident_type);
    setDepartHta(incident.depart_hta || '');
    setCommuneId(incident.commune_id);
    setVillage(incident.village);
    setDescription(incident.description || '');
    setReclamation(incident.reclamation);
    setReclamationName(incident.reclamation_name || '');
    setReclamationBy(incident.reclamation_by || 'Administration');

    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const [communeRes, typeOptions, departOptions] = await Promise.all([
          supabase.from('communes').select('id, name').order('name'),
          IncidentTypeAdminService.getOptions(),
          incident.type === 'MT' ? DepartHtaAdminService.getOptions() : Promise.resolve([]),
        ]);
        if (cancelled) return;
        if (communeRes.error) throw communeRes.error;
        setCommunes(communeRes.data || []);
        const names = typeOptions
          .filter(option => option.network_type === incident.type && (option.active || option.name === incident.incident_type))
          .map(option => option.name);
        setTypeNames(names.includes(incident.incident_type) ? names : [incident.incident_type, ...names]);
        const departs = departOptions
          .filter(option => option.active || option.name === incident.depart_hta)
          .map(option => option.name);
        setDepartNames(incident.depart_hta && !departs.includes(incident.depart_hta) ? [incident.depart_hta, ...departs] : departs);
      } catch (error) {
        if (!cancelled) Alert.alert('Erreur', error instanceof Error ? error.message : 'Chargement impossible.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Reload only when a different incident is opened for editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentId]);

  const handleSave = async () => {
    if (!incident || saving) return;
    if (!incidentType) { Alert.alert('Champ requis', "Choisissez le type d'incident."); return; }
    if (!communeId) { Alert.alert('Champ requis', 'Choisissez la commune.'); return; }
    if (!village.trim()) { Alert.alert('Champ requis', 'Saisissez le village / quartier.'); return; }
    if (incident.type === 'MT' && !departHta) { Alert.alert('Champ requis', 'Choisissez le départ HTA.'); return; }

    const nextDepart = incident.type === 'MT' ? departHta : null;
    const nextReclamationName = reclamation ? reclamationName.trim() || null : null;
    const nextReclamationBy = reclamation ? reclamationBy.trim() || null : null;

    setSaving(true);
    try {
      await IncidentAdminService.updateIncidentDetails({
        id: incident.id,
        incident_type: incidentType,
        depart_hta: nextDepart,
        commune_id: communeId,
        village,
        description,
        reclamation,
        reclamation_name: nextReclamationName,
        reclamation_by: nextReclamationBy,
      });
      onSaved(incident.id, {
        incident_type: incidentType,
        depart_hta: nextDepart,
        commune_id: communeId,
        commune_name: communes.find(commune => commune.id === communeId)?.name || incident.commune_name,
        village: village.trim(),
        description: description.trim(),
        reclamation,
        reclamation_name: nextReclamationName || undefined,
        reclamation_by: nextReclamationBy || undefined,
      });
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('NETWORK_OFFLINE')) {
        Alert.alert('Action Hors Ligne Bloquée', 'Les mutations administrateur requièrent une connexion internet active.');
      } else {
        Alert.alert('Erreur', message);
      }
    } finally {
      setSaving(false);
    }
  };

  const close = () => { if (!saving) onClose(); };

  return (
    <Modal visible={incident !== null} animationType="slide" transparent onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Modifier l&apos;incident</Text>
              {incident ? (
                <Text style={styles.subtitle}>
                  {incident.type} · {incident.status === 'open' ? 'En cours' : 'Clôturé'}
                </Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={close} disabled={saving} accessibilityLabel="Fermer">
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loading}><ActivityIndicator color={COLORS.accent} /></View>
          ) : (
            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.label}>Type d&apos;incident</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={incidentType} onValueChange={setIncidentType} enabled={!saving} style={styles.picker} dropdownIconColor={COLORS.textPrimary}>
                  {typeNames.map(name => <Picker.Item key={name} label={name} value={name} />)}
                </Picker>
              </View>

              {incident?.type === 'MT' ? (
                <>
                  <Text style={styles.label}>Départ HTA</Text>
                  <View style={styles.pickerWrap}>
                    <Picker selectedValue={departHta} onValueChange={setDepartHta} enabled={!saving} style={styles.picker} dropdownIconColor={COLORS.textPrimary}>
                      {departNames.map(name => <Picker.Item key={name} label={name} value={name} />)}
                    </Picker>
                  </View>
                </>
              ) : null}

              <Text style={styles.label}>Commune</Text>
              <View style={styles.pickerWrap}>
                <Picker selectedValue={communeId} onValueChange={setCommuneId} enabled={!saving} style={styles.picker} dropdownIconColor={COLORS.textPrimary}>
                  {communes.map(commune => <Picker.Item key={commune.id} label={commune.name} value={commune.id} />)}
                </Picker>
              </View>

              <Text style={styles.label}>Village / Quartier</Text>
              <TextInput value={village} onChangeText={setVillage} editable={!saving} style={styles.input} placeholderTextColor={COLORS.textMuted} />

              <Text style={styles.label}>Description</Text>
              <TextInput
                value={description}
                onChangeText={setDescription}
                editable={!saving}
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.multiline]}
                placeholder="Aucune description"
                placeholderTextColor={COLORS.textMuted}
              />

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Réclamation</Text>
                <Switch value={reclamation} onValueChange={setReclamation} disabled={saving} />
              </View>
              {reclamation ? (
                <>
                  <Text style={styles.label}>Nom du réclamant</Text>
                  <TextInput value={reclamationName} onChangeText={setReclamationName} editable={!saving} style={styles.input} placeholderTextColor={COLORS.textMuted} />
                  <Text style={styles.label}>Déposée par</Text>
                  <TextInput value={reclamationBy} onChangeText={setReclamationBy} editable={!saving} style={styles.input} placeholderTextColor={COLORS.textMuted} />
                </>
              ) : null}

              <View style={styles.note}>
                <Ionicons name="information-circle-outline" size={18} color={COLORS.signalBlue} />
                <Text style={styles.noteText}>
                  Le statut, le réseau, la date, la position GPS, les photos et le matériel ne sont pas modifiés ici. Chaque modification est enregistrée dans l&apos;historique.
                </Text>
              </View>
            </ScrollView>
          )}

          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancel} onPress={close} disabled={saving}>
              <Text style={styles.cancelText}>Annuler</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirm} onPress={handleSave} disabled={saving || loading}>
              {saving ? <ActivityIndicator color={COLORS.textPrimary} size="small" /> : (
                <>
                  <Ionicons name="checkmark" size={18} color={COLORS.textPrimary} />
                  <Text style={styles.confirmText}>Enregistrer</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  container: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  header: {
    padding: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: { ...TYPOGRAPHY.heading, color: COLORS.textPrimary },
  subtitle: { ...TYPOGRAPHY.label, color: COLORS.textSecondary, marginTop: 2 },
  loading: { padding: SPACING.xl * 2, alignItems: 'center' },
  form: { paddingHorizontal: SPACING.xl, paddingTop: SPACING.md },
  label: { ...TYPOGRAPHY.labelUppercase, color: COLORS.textSecondary, marginTop: SPACING.md, marginBottom: SPACING.xs },
  input: {
    minHeight: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.md,
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  multiline: { minHeight: 100, paddingTop: SPACING.md },
  pickerWrap: {
    height: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: { color: COLORS.textPrimary },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: SPACING.lg },
  switchLabel: { ...TYPOGRAPHY.bodyBold, color: COLORS.textPrimary },
  note: {
    marginVertical: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: COLORS.signalBlueTint,
    padding: SPACING.md,
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  noteText: { ...TYPOGRAPHY.label, flex: 1, color: '#1D4ED8' },
  footer: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    gap: SPACING.md,
  },
  cancel: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textSecondary },
  confirm: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  confirmText: { ...TYPOGRAPHY.bodyBold, color: COLORS.textPrimary },
});
