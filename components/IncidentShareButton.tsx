import { useAuth } from '@/contexts/AuthContext';
import { loadIncidentShareData, incidentShareSections, shareIncidentDate, shareIncidentPng, type IncidentShareData } from '@/lib/incidentShare';
import { COLORS } from '@/src/core/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, ScrollView, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText, TSpan } from 'react-native-svg';

let sharing = false;

export function IncidentShareCard({ data, svgRef, onReady, displayWidth = 720 }: {
  data: IncidentShareData;
  svgRef?: React.Ref<Svg>;
  onReady?: () => void;
  displayWidth?: number;
}) {
  const sections = incidentShareSections(data);
  let nextY = 348;
  const positioned = sections.map(section => {
    const y = nextY;
    nextY += 56 + section.lines.length * 33 + 28;
    return { ...section, y };
  });
  const height = nextY + 100;
  return <Svg ref={svgRef} width={displayWidth} height={height * displayWidth / 720} viewBox={`0 0 720 ${height}`} onLayout={onReady}>
    <Rect width={720} height={height} fill={COLORS.surface} />
    <Rect width={720} height={190} fill={COLORS.textPrimary} />
    <SvgText x={48} y={76} fill={COLORS.surface} fontFamily="Inter_700Bold" fontSize={48}>intervX</SvgText>
    <SvgText x={50} y={119} fill={COLORS.accent} fontFamily="Inter_700Bold" fontSize={17} letterSpacing={2}>SIGNALEMENT TERRAIN</SvgText>
    <SvgText x={50} y={157} fill={COLORS.borderStrong} fontFamily="Inter_400Regular" fontSize={18}>FICHE INCIDENT · {data.reference}</SvgText>
    <Rect x={582} y={49} width={90} height={70} rx={8} fill={COLORS.accent} />
    <SvgText x={627} y={96} textAnchor="middle" fill={COLORS.textPrimary} fontFamily="Inter_700Bold" fontSize={35}>{data.type}</SvgText>
    <Rect x={48} y={220} width={190} height={43} rx={4} fill={data.status === 'closed' ? COLORS.signalGreenTint : COLORS.signalRedTint} />
    <SvgText x={65} y={249} fill={COLORS.textPrimary} fontFamily="Inter_700Bold" fontSize={19}>{data.status === 'closed' ? 'CLÔTURÉ' : 'EN COURS'}</SvgText>
    <SvgText x={672} y={248} textAnchor="end" fill={COLORS.textPrimary} fontFamily="Inter_500Medium" fontSize={21}>{shareIncidentDate(data.date)}</SvgText>
    <SvgText x={48} y={303} fill={COLORS.textSecondary} fontFamily="Inter_400Regular" fontSize={17}>
      {data.synced ? 'Synchronisé' : 'Enregistré localement · synchronisation en attente'}
    </SvgText>
    {data.reclamation && <SvgText x={672} y={303} textAnchor="end" fill={COLORS.textPrimary} fontFamily="Inter_700Bold" fontSize={16}>RÉCLAMATION</SvgText>}
    {positioned.map(section => <SvgText key={section.label} fill={COLORS.textPrimary} fontFamily="Inter_400Regular" fontSize={25}>
      <TSpan x={48} y={section.y} fill={COLORS.textSecondary} fontFamily="Inter_700Bold" fontSize={17} letterSpacing={1.3}>{section.label}</TSpan>
      {section.lines.map((line, index) => <TSpan key={index} x={48} y={section.y + 40 + index * 33}>{line || ' '}</TSpan>)}
    </SvgText>)}
    <Line x1={48} x2={672} y1={nextY + 5} y2={nextY + 5} stroke={COLORS.border} />
    <SvgText x={48} y={nextY + 48} fill={COLORS.textSecondary} fontFamily="Inter_400Regular" fontSize={17}>IntervX · Gestion des incidents terrain</SvgText>
    <SvgText x={672} y={nextY + 48} textAnchor="end" fill={COLORS.textSecondary} fontFamily="Inter_500Medium" fontSize={17}>BT / MT</SvgText>
  </Svg>;
}

export default function IncidentShareButton({ incidentId }: { incidentId: number }) {
  const { user } = useAuth();
  const db = useSQLiteContext();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<IncidentShareData | null>(null);
  const svg = useRef<Svg>(null);
  const ready = useRef<((image: string) => void) | null>(null);
  const activeUser = useRef(user?.id);
  activeUser.current = user?.id;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  const share = async () => {
    if (sharing || !user || Platform.OS === 'web') return;
    sharing = true;
    setBusy(true);
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      if (!await Sharing.isAvailableAsync()) throw new Error('Le partage est indisponible sur ce téléphone.');
      const ownerId = user.id;
      const card = await loadIncidentShareData(db, incidentId, ownerId);
      const current = () => mounted.current && activeUser.current === ownerId;
      if (!current()) return;
      const image = new Promise<string>((resolve, reject) => {
        ready.current = resolve;
        timeout = setTimeout(() => reject(new Error('La préparation de l’image a expiré. Réessayez.')), 10000);
      });
      setData(card);
      const base64 = await image;
      clearTimeout(timeout);
      if (!current()) return;
      await shareIncidentPng(base64, incidentId, current);
    } catch (error) {
      if (mounted.current) Alert.alert('Partage indisponible', error instanceof Error ? error.message : 'Impossible de partager cet incident.');
    } finally {
      clearTimeout(timeout);
      ready.current = null;
      sharing = false;
      if (mounted.current) { setData(null); setBusy(false); }
    }
  };

  if (Platform.OS === 'web') return null;
  const scale = Math.min((width - 48) / 720, 1);
  const cardHeight = data ? 448 + incidentShareSections(data).reduce((total, section) => total + 84 + section.lines.length * 33, 0) : 0;
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Partager l’incident en image" accessibilityState={{ disabled: busy, busy }}
      disabled={busy} hitSlop={4} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: COLORS.background }}
      onPress={event => { event.stopPropagation(); void share(); }}>
      {busy ? <ActivityIndicator color={COLORS.textPrimary} size="small" /> : <Ionicons name="share-social-outline" size={22} color={COLORS.textPrimary} />}
    </TouchableOpacity>
    <Modal visible={Boolean(data)} transparent animationType="none" onRequestClose={() => undefined}>
      <View style={{ flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', padding: 24 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 20 }}>
          <ActivityIndicator color={COLORS.textPrimary} /><Text style={{ color: COLORS.textPrimary }}>Préparation du partage…</Text>
        </View>
        <ScrollView style={{ maxHeight: '75%' }} pointerEvents="none">
          <View style={{ height: cardHeight * scale, width: 720 * scale }}>
              {data && <IncidentShareCard data={data} displayWidth={720 * scale} svgRef={svg} onReady={() => {
                const callback = ready.current;
                if (!callback) return;
                ready.current = null;
                requestAnimationFrame(() => svg.current?.toDataURL(callback, { width: 720, height: cardHeight }));
              }} />}
          </View>
        </ScrollView>
      </View>
    </Modal>
  </>;
}
