export const PUBLIC_PRODUCT_SELECT = 'id,sku,name,slug,description,short_description,category_id,price,compare_price,images,stock_quantity,weight_grams,dimensions,active,featured,meta_title,meta_description,created_at,updated_at' as const;

export const PUBLIC_PRODUCT_COLUMNS = PUBLIC_PRODUCT_SELECT.split(',');
