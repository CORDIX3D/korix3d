export const PUBLIC_MATERIAL_COLUMNS = 'id, name, slug, description' as const;

export type PublicMaterial = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
};

