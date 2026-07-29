import type { PortfolioItem } from '@/lib/types/database';

export const PUBLIC_PORTFOLIO_COLUMNS =
  'id,title,description,image_url,category,material,print_time_hours,featured,active,sort_order,created_at' as const;

export type PublicPortfolioItem = Pick<
  PortfolioItem,
  | 'id'
  | 'title'
  | 'description'
  | 'image_url'
  | 'category'
  | 'material'
  | 'print_time_hours'
  | 'featured'
  | 'active'
  | 'sort_order'
  | 'created_at'
>;
