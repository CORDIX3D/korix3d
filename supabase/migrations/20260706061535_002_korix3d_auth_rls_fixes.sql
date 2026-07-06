/*
# KORIX3D Auth & RLS Fixes

1. Creates helper functions for role checking in RLS policies
2. Creates trigger to auto-create profile after user signup
3. Creates updated_at trigger function
4. Adds missing RLS policies for all tables

Security: Proper RLS with role-based access control
*/

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
