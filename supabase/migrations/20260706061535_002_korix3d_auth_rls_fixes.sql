/*
# KORIX3D Auth & RLS Fixes

1. Creates helper functions for role checking in RLS policies
2. Creates trigger to auto-create profile after user signup
3. Creates updated_at trigger function
4. Adds missing RLS policies for all tables

Security: Proper RLS with role-based access control
*/

-- The original project was created from a dashboard schema that was not kept
-- in this repository. Keep this migration self-contained so a fresh Supabase
-- project has every relation required by the policies and later migrations.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_quote_order_number()
RETURNS text
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT 'WYC-' || to_char(now(), 'YYYYMMDD') || '-' ||
    upper(left(replace(gen_random_uuid()::text, '-', ''), 6));
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  avatar_url text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'employee', 'customer')),
  company text,
  nip text,
  address_street text,
  address_city text,
  address_zip text,
  address_country text NOT NULL DEFAULT 'PL',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  price_per_kg numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  available boolean NOT NULL DEFAULT true,
  print_temp_min integer,
  print_temp_max integer,
  bed_temp_min integer,
  bed_temp_max integer,
  properties jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.material_colors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  name text NOT NULL,
  hex text NOT NULL DEFAULT '#FFFFFF',
  available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  image_url text,
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  short_description text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  price numeric(12,2) NOT NULL DEFAULT 0,
  compare_price numeric(12,2),
  cost_price numeric(12,2),
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  stock_quantity integer NOT NULL DEFAULT 0,
  min_stock_quantity integer NOT NULL DEFAULT 0,
  weight_grams integer,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  featured boolean NOT NULL DEFAULT false,
  stripe_price_id text,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.filaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand text NOT NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name text NOT NULL,
  color text NOT NULL,
  color_hex text NOT NULL DEFAULT '#FFFFFF',
  image_url text,
  price_per_kg numeric(10,2),
  remaining_weight_grams numeric NOT NULL DEFAULT 0,
  original_weight_grams numeric NOT NULL DEFAULT 1000,
  price_paid numeric(10,2),
  min_weight_grams numeric NOT NULL DEFAULT 100,
  location text,
  opened_at timestamptz,
  expires_at timestamptz,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.warehouse_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text NOT NULL,
  barcode text,
  qr_code text,
  name text NOT NULL,
  quantity integer NOT NULL DEFAULT 0,
  min_quantity integer NOT NULL DEFAULT 0,
  warehouse_location text,
  purchase_price numeric(12,2),
  selling_price numeric(12,2),
  weight_grams integer,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.orders_3d (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL DEFAULT public.generate_quote_order_number(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  material_name text,
  color text,
  color_hex text,
  layer_height numeric(6,3),
  quantity integer NOT NULL DEFAULT 1,
  priority text NOT NULL DEFAULT 'standard',
  notes text,
  status text NOT NULL DEFAULT 'new',
  files jsonb NOT NULL DEFAULT '[]'::jsonb,
  printing_time_hours numeric(12,2),
  filament_used_grams numeric(12,2),
  material_cost numeric(12,2),
  electricity_cost numeric(12,2),
  printing_cost numeric(12,2),
  packaging_cost numeric(12,2),
  margin_amount numeric(12,2),
  vat_amount numeric(12,2),
  final_price numeric(12,2),
  tracking_number text,
  shipped_at timestamptz,
  assigned_to uuid,
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.store_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  customer_email text NOT NULL,
  customer_name text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  shipping_cost numeric(12,2) NOT NULL DEFAULT 0,
  vat_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  stripe_session_id text,
  stripe_payment_intent_id text,
  checkout_token_hash text,
  tracking_number text,
  coupon_code text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.store_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.store_orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  sku text NOT NULL,
  name text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL CHECK (unit_price >= 0),
  unit_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  total numeric(12,2) NOT NULL CHECK (total >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  content text,
  approved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  read boolean NOT NULL DEFAULT false,
  link text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL,
  excerpt text,
  content text,
  cover_image_url text,
  author_id uuid,
  category text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  meta_title text,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.faq_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL,
  answer text NOT NULL,
  category text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  value text,
  label text,
  category text NOT NULL DEFAULT 'general',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  discount_type text NOT NULL DEFAULT 'percent' CHECK (discount_type IN ('percent', 'fixed')),
  discount_value numeric(12,2) NOT NULL CHECK (discount_value >= 0),
  min_order_value numeric(12,2),
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subject text,
  content text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  replied boolean NOT NULL DEFAULT false,
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  image_url text,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  material text,
  category text,
  print_time_hours numeric(12,2),
  featured boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders_3d(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.filament_usage_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filament_id uuid REFERENCES public.filaments(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.orders_3d(id) ON DELETE SET NULL,
  grams_used numeric(12,3) NOT NULL DEFAULT 0,
  material_name text,
  color text,
  min_weight_grams numeric(12,3),
  remaining_weight_grams numeric(12,3),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_colors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_3d ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faq_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.filament_usage_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS FOR ROLE CHECKING
-- ============================================

-- Function to check if user is admin (SECURITY DEFINER prevents infinite recursion)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to check if user is employee or admin
CREATE OR REPLACE FUNCTION is_employee()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid() AND profiles.role IN ('admin', 'employee')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Function to get current user's role
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS text AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(user_role, 'customer');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================
-- AUTO-CREATE PROFILE TRIGGER
-- ============================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'customer'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger on auth.users table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- UPDATED AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS POLICIES FOR PROFILES TABLE
-- ============================================

-- Users can view their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id OR is_admin());

-- Users can update their own profile
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id OR is_admin());

-- Only admins can insert profiles (trigger handles auto-creation)
DROP POLICY IF EXISTS "profiles_insert_admin" ON profiles;
CREATE POLICY "profiles_insert_admin" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (is_admin() OR auth.uid() = id);

-- Only admins can delete profiles
DROP POLICY IF EXISTS "profiles_delete_admin" ON profiles;
CREATE POLICY "profiles_delete_admin" ON profiles
  FOR DELETE TO authenticated
  USING (is_admin());

-- ============================================
-- RLS POLICIES FOR ORDERS_3D TABLE
-- ============================================

-- Users can view their own orders
DROP POLICY IF EXISTS "orders_3d_select_own" ON orders_3d;
CREATE POLICY "orders_3d_select_own" ON orders_3d
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_employee());

-- Users can insert their own orders
DROP POLICY IF EXISTS "orders_3d_insert_own" ON orders_3d;
CREATE POLICY "orders_3d_insert_own" ON orders_3d
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_admin());

-- Employees and admins can update orders
DROP POLICY IF EXISTS "orders_3d_update_staff" ON orders_3d;
CREATE POLICY "orders_3d_update_staff" ON orders_3d
  FOR UPDATE TO authenticated
  USING (is_employee())
  WITH CHECK (is_employee());

-- Only admins can delete orders
DROP POLICY IF EXISTS "orders_3d_delete_admin" ON orders_3d;
CREATE POLICY "orders_3d_delete_admin" ON orders_3d
  FOR DELETE TO authenticated
  USING (is_admin());

-- ============================================
-- RLS POLICIES FOR PRODUCTS TABLE (PUBLIC READ)
-- ============================================

-- Everyone can read active products
DROP POLICY IF EXISTS "products_public_read" ON products;
CREATE POLICY "products_public_read" ON products
  FOR SELECT TO authenticated, anon
  USING (active = true OR is_admin());

-- Only admins can modify products
DROP POLICY IF EXISTS "products_admin_write" ON products;
CREATE POLICY "products_admin_write" ON products
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR CATEGORIES TABLE (PUBLIC READ)
-- ============================================

DROP POLICY IF EXISTS "categories_public_read" ON categories;
CREATE POLICY "categories_public_read" ON categories
  FOR SELECT TO authenticated, anon
  USING (active = true OR is_admin());

DROP POLICY IF EXISTS "categories_admin_write" ON categories;
CREATE POLICY "categories_admin_write" ON categories
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR MATERIALS TABLE (PUBLIC READ)
-- ============================================

DROP POLICY IF EXISTS "materials_public_read" ON materials;
CREATE POLICY "materials_public_read" ON materials
  FOR SELECT TO authenticated, anon
  USING (available = true OR is_admin());

DROP POLICY IF EXISTS "materials_admin_write" ON materials;
CREATE POLICY "materials_admin_write" ON materials
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR MATERIAL_COLORS TABLE
-- ============================================

DROP POLICY IF EXISTS "material_colors_public_read" ON material_colors;
CREATE POLICY "material_colors_public_read" ON material_colors
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "material_colors_admin_write" ON material_colors;
CREATE POLICY "material_colors_admin_write" ON material_colors
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR FILAMENTS TABLE
-- ============================================

DROP POLICY IF EXISTS "filaments_employee_read" ON filaments;
CREATE POLICY "filaments_employee_read" ON filaments
  FOR SELECT TO authenticated
  USING (is_employee());

DROP POLICY IF EXISTS "filaments_employee_write" ON filaments;
CREATE POLICY "filaments_employee_write" ON filaments
  FOR ALL TO authenticated
  USING (is_employee())
  WITH CHECK (is_employee());

-- ============================================
-- RLS POLICIES FOR WAREHOUSE_ITEMS TABLE
-- ============================================

DROP POLICY IF EXISTS "warehouse_items_employee_read" ON warehouse_items;
CREATE POLICY "warehouse_items_employee_read" ON warehouse_items
  FOR SELECT TO authenticated
  USING (is_employee());

DROP POLICY IF EXISTS "warehouse_items_employee_write" ON warehouse_items;
CREATE POLICY "warehouse_items_employee_write" ON warehouse_items
  FOR ALL TO authenticated
  USING (is_employee())
  WITH CHECK (is_employee());

-- ============================================
-- RLS POLICIES FOR CART_ITEMS TABLE
-- ============================================

DROP POLICY IF EXISTS "cart_items_user_read" ON cart_items;
CREATE POLICY "cart_items_user_read" ON cart_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_items_user_write" ON cart_items;
CREATE POLICY "cart_items_user_write" ON cart_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES FOR WISHLIST_ITEMS TABLE
-- ============================================

DROP POLICY IF EXISTS "wishlist_items_user_read" ON wishlist_items;
CREATE POLICY "wishlist_items_user_read" ON wishlist_items
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wishlist_items_user_write" ON wishlist_items;
CREATE POLICY "wishlist_items_user_write" ON wishlist_items
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- RLS POLICIES FOR STORE_ORDERS TABLE
-- ============================================

DROP POLICY IF EXISTS "store_orders_user_read" ON store_orders;
CREATE POLICY "store_orders_user_read" ON store_orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_employee());

DROP POLICY IF EXISTS "store_orders_user_insert" ON store_orders;
CREATE POLICY "store_orders_user_insert" ON store_orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "store_orders_employee_update" ON store_orders;
CREATE POLICY "store_orders_employee_update" ON store_orders
  FOR UPDATE TO authenticated
  USING (is_employee())
  WITH CHECK (is_employee());

-- ============================================
-- RLS POLICIES FOR STORE_ORDER_ITEMS TABLE
-- ============================================

DROP POLICY IF EXISTS "store_order_items_via_order" ON store_order_items;
CREATE POLICY "store_order_items_via_order" ON store_order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM store_orders
      WHERE store_orders.id = store_order_items.order_id
      AND (store_orders.user_id = auth.uid() OR is_employee())
    )
  );

DROP POLICY IF EXISTS "store_order_items_admin" ON store_order_items;
CREATE POLICY "store_order_items_admin" ON store_order_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR PRODUCT_REVIEWS TABLE
-- ============================================

DROP POLICY IF EXISTS "product_reviews_read" ON product_reviews;
CREATE POLICY "product_reviews_read" ON product_reviews
  FOR SELECT TO authenticated, anon
  USING (approved = true OR auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "product_reviews_user_insert" ON product_reviews;
CREATE POLICY "product_reviews_user_insert" ON product_reviews
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "product_reviews_admin_write" ON product_reviews;
CREATE POLICY "product_reviews_admin_write" ON product_reviews
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR NOTIFICATIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "notifications_user_read" ON notifications;
CREATE POLICY "notifications_user_read" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_user_update" ON notifications;
CREATE POLICY "notifications_user_update" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_admin_insert" ON notifications;
CREATE POLICY "notifications_admin_insert" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR BLOG_POSTS TABLE
-- ============================================

DROP POLICY IF EXISTS "blog_posts_public_read" ON blog_posts;
CREATE POLICY "blog_posts_public_read" ON blog_posts
  FOR SELECT TO authenticated, anon
  USING (published = true OR is_admin());

DROP POLICY IF EXISTS "blog_posts_admin_write" ON blog_posts;
CREATE POLICY "blog_posts_admin_write" ON blog_posts
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR FAQ_ITEMS TABLE
-- ============================================

DROP POLICY IF EXISTS "faq_items_public_read" ON faq_items;
CREATE POLICY "faq_items_public_read" ON faq_items
  FOR SELECT TO authenticated, anon
  USING (active = true OR is_admin());

DROP POLICY IF EXISTS "faq_items_admin_write" ON faq_items;
CREATE POLICY "faq_items_admin_write" ON faq_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR SETTINGS TABLE
-- ============================================

-- Everyone can read settings
DROP POLICY IF EXISTS "settings_public_read" ON settings;
CREATE POLICY "settings_public_read" ON settings
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON settings;
CREATE POLICY "settings_admin_write" ON settings
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR DISCOUNT_CODES TABLE
-- ============================================

DROP POLICY IF EXISTS "discount_codes_user_read" ON discount_codes;
CREATE POLICY "discount_codes_user_read" ON discount_codes
  FOR SELECT TO authenticated
  USING (active = true AND (expires_at IS NULL OR expires_at > now()) OR is_admin());

DROP POLICY IF EXISTS "discount_codes_admin_write" ON discount_codes;
CREATE POLICY "discount_codes_admin_write" ON discount_codes
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR MESSAGES TABLE
-- ============================================

DROP POLICY IF EXISTS "messages_user_access" ON messages;
CREATE POLICY "messages_user_access" ON messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id OR is_admin());

DROP POLICY IF EXISTS "messages_user_insert" ON messages;
CREATE POLICY "messages_user_insert" ON messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id OR is_admin());

-- ============================================
-- RLS POLICIES FOR CONTACT_SUBMISSIONS TABLE
-- ============================================

DROP POLICY IF EXISTS "contact_submissions_admin_read" ON contact_submissions;
CREATE POLICY "contact_submissions_admin_read" ON contact_submissions
  FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "contact_submissions_public_insert" ON contact_submissions;
CREATE POLICY "contact_submissions_public_insert" ON contact_submissions
  FOR INSERT TO authenticated, anon
  WITH CHECK (true);

-- ============================================
-- RLS POLICIES FOR PORTFOLIO_ITEMS TABLE
-- ============================================

DROP POLICY IF EXISTS "portfolio_items_public_read" ON portfolio_items;
CREATE POLICY "portfolio_items_public_read" ON portfolio_items
  FOR SELECT TO authenticated, anon
  USING (active = true OR is_admin());

DROP POLICY IF EXISTS "portfolio_items_admin_write" ON portfolio_items;
CREATE POLICY "portfolio_items_admin_write" ON portfolio_items
  FOR ALL TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ============================================
-- RLS POLICIES FOR ORDER_STATUS_HISTORY TABLE
-- ============================================

DROP POLICY IF EXISTS "order_status_history_via_order" ON order_status_history;
CREATE POLICY "order_status_history_via_order" ON order_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders_3d
      WHERE orders_3d.id = order_status_history.order_id
      AND (orders_3d.user_id = auth.uid() OR is_employee())
    )
  );

DROP POLICY IF EXISTS "order_status_history_employee_write" ON order_status_history;
CREATE POLICY "order_status_history_employee_write" ON order_status_history
  FOR ALL TO authenticated
  USING (is_employee())
  WITH CHECK (is_employee());

-- ============================================
-- RLS POLICIES FOR FILAMENT_USAGE_LOG TABLE
-- ============================================

DROP POLICY IF EXISTS "filament_usage_log_employee_read" ON filament_usage_log;
CREATE POLICY "filament_usage_log_employee_read" ON filament_usage_log
  FOR SELECT TO authenticated
  USING (is_employee());

DROP POLICY IF EXISTS "filament_usage_log_employee_write" ON filament_usage_log;
CREATE POLICY "filament_usage_log_employee_write" ON filament_usage_log
  FOR ALL TO authenticated
  USING (is_employee())
  WITH CHECK (is_employee());
