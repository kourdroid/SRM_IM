export const BT_INCIDENT_TYPES = [
  'Manque phase',
  'Manque deux phases',
  'Manque trois phases',
  'Manque neutre',
  'Manque tension',
  'Chute de tension',
  'Court-circuit',
  'Câble à la terre',
  'Câble par terre / chute de câble',
  'Déclenchement disjoncteur BT',
  'Bouclage phases',
  'Amorçage',
  'Remplacement transformateur',
  'Tirage câble BT',
  'Accident routier (dommage réseau)',
  'Autre',
] as const;

export const MT_INCIDENT_TYPES = [
  'Câble conducteur cisaillé',
  'Déclenchement départ HTA',
  'Manque tension HTA',
  'Remplacement transformateur HTA',
  'Bretelle rompu',
  'Bretelles rompues',
  'Câble rompu',
  'Transformateur avarié',
  'Cellule préfabriquée avariée',
  'Parafoudre avarié',
  'Amorçage',
  'Amorçage Cellule Préfabriquée',
  'Autre',
] as const;

export function getIncidentTypesForType(type: 'BT' | 'MT') {
  return type === 'BT' ? BT_INCIDENT_TYPES : MT_INCIDENT_TYPES;
}
