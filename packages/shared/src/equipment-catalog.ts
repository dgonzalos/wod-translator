// Small fixed vocabulary shared by the web equipment selector and the
// backend adapt prompt/validation (spec §9's "catálogo inicial pequeño de
// material") — both sides must agree on the exact strings, or the backend's
// catalog filter would silently drop everything the UI sends.
export const EQUIPMENT_CATALOG = [
  'Barra olímpica y discos',
  'Mancuernas',
  'Kettlebell',
  'Barra de dominadas',
  'Comba',
  'Remo (máquina)',
  'Bici estática / assault bike',
  'Cajón (box)',
  'Balón medicinal (wall ball)',
  'Bandas elásticas',
  'Sin material adicional (peso corporal)',
] as const;

export type EquipmentCatalogItem = (typeof EQUIPMENT_CATALOG)[number];
