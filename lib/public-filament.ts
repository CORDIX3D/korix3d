export const PUBLIC_FILAMENT_COLUMNS =
  'id, brand, material_id, material_name, color, color_hex' as const;

export type PublicFilament = {
  id: string;
  brand: string | null;
  material_id: string | null;
  material_name: string;
  color: string;
  color_hex: string | null;
};

