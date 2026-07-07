// Database Types for KORIX3D Platform

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          phone: string | null;
          avatar_url: string | null;
          role: 'admin' | 'employee' | 'customer';
          company: string | null;
          nip: string | null;
          address_street: string | null;
          address_city: string | null;
          address_zip: string | null;
          address_country: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: 'admin' | 'employee' | 'customer';
          company?: string | null;
          nip?: string | null;
          address_street?: string | null;
          address_city?: string | null;
          address_zip?: string | null;
          address_country?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          role?: 'admin' | 'employee' | 'customer';
          company?: string | null;
          nip?: string | null;
          address_street?: string | null;
          address_city?: string | null;
          address_zip?: string | null;
          address_country?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      materials: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          price_per_kg: number;
          image_url: string | null;
          available: boolean | null;
          print_temp_min: number | null;
          print_temp_max: number | null;
          bed_temp_min: number | null;
          bed_temp_max: number | null;
          properties: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          price_per_kg?: number;
          image_url?: string | null;
          available?: boolean | null;
          print_temp_min?: number | null;
          print_temp_max?: number | null;
          bed_temp_min?: number | null;
          bed_temp_max?: number | null;
          properties?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          price_per_kg?: number;
          image_url?: string | null;
          available?: boolean | null;
          print_temp_min?: number | null;
          print_temp_max?: number | null;
          bed_temp_min?: number | null;
          bed_temp_max?: number | null;
          properties?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      material_colors: {
        Row: {
          id: string;
          material_id: string;
          name: string;
          hex: string;
          available: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          material_id: string;
          name: string;
          hex?: string;
          available?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          material_id?: string;
          name?: string;
          hex?: string;
          available?: boolean | null;
          created_at?: string;
        };
      };
      products: {
        Row: {
          id: string;
          sku: string;
          name: string;
          slug: string;
          description: string | null;
          short_description: string | null;
          category_id: string | null;
          price: number;
          compare_price: number | null;
          cost_price: number | null;
          images: Json;
          stock_quantity: number;
          min_stock_quantity: number | null;
          weight_grams: number | null;
          dimensions: Json;
          active: boolean | null;
          featured: boolean | null;
          stripe_price_id: string | null;
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          sku: string;
          name: string;
          slug: string;
          description?: string | null;
          short_description?: string | null;
          category_id?: string | null;
          price: number;
          compare_price?: number | null;
          cost_price?: number | null;
          images?: Json;
          stock_quantity?: number;
          min_stock_quantity?: number | null;
          weight_grams?: number | null;
          dimensions?: Json;
          active?: boolean | null;
          featured?: boolean | null;
          stripe_price_id?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          sku?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          short_description?: string | null;
          category_id?: string | null;
          price?: number;
          compare_price?: number | null;
          cost_price?: number | null;
          images?: Json;
          stock_quantity?: number;
          min_stock_quantity?: number | null;
          weight_grams?: number | null;
          dimensions?: Json;
          active?: boolean | null;
          featured?: boolean | null;
          stripe_price_id?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          parent_id: string | null;
          sort_order: number | null;
          active: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number | null;
          active?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          parent_id?: string | null;
          sort_order?: number | null;
          active?: boolean | null;
          created_at?: string;
        };
      };
      orders_3d: {
        Row: {
          id: string;
          order_number: string;
          user_id: string;
          material_id: string | null;
          material_name: string | null;
          color: string | null;
          color_hex: string | null;
          layer_height: number | null;
          quantity: number;
          priority: 'standard' | 'express' | 'urgent';
          notes: string | null;
          status: 'new' | 'quoted' | 'accepted' | 'queued' | 'printing' | 'post_processing' | 'packed' | 'shipped' | 'completed' | 'cancelled';
          files: Json;
          printing_time_hours: number | null;
          filament_used_grams: number | null;
          material_cost: number | null;
          electricity_cost: number | null;
          printing_cost: number | null;
          packaging_cost: number | null;
          margin_amount: number | null;
          vat_amount: number | null;
          final_price: number | null;
          tracking_number: string | null;
          shipped_at: string | null;
          assigned_to: string | null;
          admin_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string;
          material_id?: string | null;
          material_name?: string | null;
          color?: string | null;
          color_hex?: string | null;
          layer_height?: number | null;
          quantity?: number;
          priority?: 'standard' | 'express' | 'urgent';
          notes?: string | null;
          status?: 'new' | 'quoted' | 'accepted' | 'queued' | 'printing' | 'post_processing' | 'packed' | 'shipped' | 'completed' | 'cancelled';
          files?: Json;
          printing_time_hours?: number | null;
          filament_used_grams?: number | null;
          material_cost?: number | null;
          electricity_cost?: number | null;
          printing_cost?: number | null;
          packaging_cost?: number | null;
          margin_amount?: number | null;
          vat_amount?: number | null;
          final_price?: number | null;
          tracking_number?: string | null;
          shipped_at?: string | null;
          assigned_to?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string;
          material_id?: string | null;
          material_name?: string | null;
          color?: string | null;
          color_hex?: string | null;
          layer_height?: number | null;
          quantity?: number;
          priority?: 'standard' | 'express' | 'urgent';
          notes?: string | null;
          status?: 'new' | 'quoted' | 'accepted' | 'queued' | 'printing' | 'post_processing' | 'packed' | 'shipped' | 'completed' | 'cancelled';
          files?: Json;
          printing_time_hours?: number | null;
          filament_used_grams?: number | null;
          material_cost?: number | null;
          electricity_cost?: number | null;
          printing_cost?: number | null;
          packaging_cost?: number | null;
          margin_amount?: number | null;
          vat_amount?: number | null;
          final_price?: number | null;
          tracking_number?: string | null;
          shipped_at?: string | null;
          assigned_to?: string | null;
          admin_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      filaments: {
        Row: {
          id: string;
          brand: string;
          material_id: string | null;
          material_name: string;
          color: string;
          color_hex: string | null;
          remaining_weight_grams: number;
          original_weight_grams: number | null;
          price_paid: number | null;
          min_weight_grams: number | null;
          location: string | null;
          opened_at: string | null;
          expires_at: string | null;
          notes: string | null;
          active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand: string;
          material_id?: string | null;
          material_name: string;
          color: string;
          color_hex?: string | null;
          remaining_weight_grams?: number;
          original_weight_grams?: number | null;
          price_paid?: number | null;
          min_weight_grams?: number | null;
          location?: string | null;
          opened_at?: string | null;
          expires_at?: string | null;
          notes?: string | null;
          active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand?: string;
          material_id?: string | null;
          material_name?: string;
          color?: string;
          color_hex?: string | null;
          remaining_weight_grams?: number;
          original_weight_grams?: number | null;
          price_paid?: number | null;
          min_weight_grams?: number | null;
          location?: string | null;
          opened_at?: string | null;
          expires_at?: string | null;
          notes?: string | null;
          active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      warehouse_items: {
        Row: {
          id: string;
          product_id: string | null;
          sku: string;
          barcode: string | null;
          qr_code: string | null;
          name: string;
          quantity: number;
          min_quantity: number | null;
          warehouse_location: string | null;
          purchase_price: number | null;
          selling_price: number | null;
          weight_grams: number | null;
          dimensions: Json;
          images: Json;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id?: string | null;
          sku: string;
          barcode?: string | null;
          qr_code?: string | null;
          name: string;
          quantity?: number;
          min_quantity?: number | null;
          warehouse_location?: string | null;
          purchase_price?: number | null;
          selling_price?: number | null;
          weight_grams?: number | null;
          dimensions?: Json;
          images?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string | null;
          sku?: string;
          barcode?: string | null;
          qr_code?: string | null;
          name?: string;
          quantity?: number;
          min_quantity?: number | null;
          warehouse_location?: string | null;
          purchase_price?: number | null;
          selling_price?: number | null;
          weight_grams?: number | null;
          dimensions?: Json;
          images?: Json;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      store_orders: {
        Row: {
          id: string;
          order_number: string;
          user_id: string | null;
          status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
          customer_email: string;
          customer_name: string | null;
          shipping_address: Json;
          billing_address: Json;
          subtotal: number;
          discount_amount: number | null;
          shipping_cost: number | null;
          vat_amount: number | null;
          total: number;
          stripe_session_id: string | null;
          stripe_payment_intent_id: string | null;
          tracking_number: string | null;
          coupon_code: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
          customer_email: string;
          customer_name?: string | null;
          shipping_address?: Json;
          billing_address?: Json;
          subtotal: number;
          discount_amount?: number | null;
          shipping_cost?: number | null;
          vat_amount?: number | null;
          total: number;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          tracking_number?: string | null;
          coupon_code?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_number?: string;
          user_id?: string | null;
          status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
          customer_email?: string;
          customer_name?: string | null;
          shipping_address?: Json;
          billing_address?: Json;
          subtotal?: number;
          discount_amount?: number | null;
          shipping_cost?: number | null;
          vat_amount?: number | null;
          total?: number;
          stripe_session_id?: string | null;
          stripe_payment_intent_id?: string | null;
          tracking_number?: string | null;
          coupon_code?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          quantity: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          product_id: string;
          quantity?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          quantity?: number;
          created_at?: string;
        };
      };
      wishlist_items: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          product_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          created_at?: string;
        };
      };
      blog_posts: {
        Row: {
          id: string;
          title: string;
          slug: string;
          excerpt: string | null;
          content: string | null;
          cover_image_url: string | null;
          author_id: string | null;
          category: string | null;
          tags: Json;
          published: boolean | null;
          published_at: string | null;
          meta_title: string | null;
          meta_description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          excerpt?: string | null;
          content?: string | null;
          cover_image_url?: string | null;
          author_id?: string | null;
          category?: string | null;
          tags?: Json;
          published?: boolean | null;
          published_at?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          excerpt?: string | null;
          content?: string | null;
          cover_image_url?: string | null;
          author_id?: string | null;
          category?: string | null;
          tags?: Json;
          published?: boolean | null;
          published_at?: string | null;
          meta_title?: string | null;
          meta_description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      faq_items: {
        Row: {
          id: string;
          question: string;
          answer: string;
          category: string | null;
          sort_order: number | null;
          active: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question: string;
          answer: string;
          category?: string | null;
          sort_order?: number | null;
          active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          question?: string;
          answer?: string;
          category?: string | null;
          sort_order?: number | null;
          active?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          message: string;
          type: 'info' | 'success' | 'warning' | 'error' | null;
          read: boolean | null;
          link: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          message: string;
          type?: 'info' | 'success' | 'warning' | 'error' | null;
          read?: boolean | null;
          link?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          message?: string;
          type?: 'info' | 'success' | 'warning' | 'error' | null;
          read?: boolean | null;
          link?: string | null;
          created_at?: string;
        };
      };
      settings: {
        Row: {
          id: string;
          key: string;
          value: string | null;
          label: string | null;
          category: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value?: string | null;
          label?: string | null;
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string | null;
          label?: string | null;
          category?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      discount_codes: {
        Row: {
          id: string;
          code: string;
          description: string | null;
          discount_type: 'percent' | 'fixed';
          discount_value: number;
          min_order_value: number | null;
          max_uses: number | null;
          used_count: number | null;
          active: boolean | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          description?: string | null;
          discount_type?: 'percent' | 'fixed';
          discount_value: number;
          min_order_value?: number | null;
          max_uses?: number | null;
          used_count?: number | null;
          active?: boolean | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          description?: string | null;
          discount_type?: 'percent' | 'fixed';
          discount_value?: number;
          min_order_value?: number | null;
          max_uses?: number | null;
          used_count?: number | null;
          active?: boolean | null;
          expires_at?: string | null;
          created_at?: string;
        };
      };
      portfolio_items: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          image_url: string | null;
          images: Json;
          material: string | null;
          category: string | null;
          print_time_hours: number | null;
          featured: boolean | null;
          active: boolean | null;
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          image_url?: string | null;
          images?: Json;
          material?: string | null;
          category?: string | null;
          print_time_hours?: number | null;
          featured?: boolean | null;
          active?: boolean | null;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          image_url?: string | null;
          images?: Json;
          material?: string | null;
          category?: string | null;
          print_time_hours?: number | null;
          featured?: boolean | null;
          active?: boolean | null;
          sort_order?: number | null;
          created_at?: string;
        };
      };
      contact_submissions: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          subject: string | null;
          message: string;
          read: boolean | null;
          replied: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          subject?: string | null;
          message: string;
          read?: boolean | null;
          replied?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          subject?: string | null;
          message?: string;
          read?: boolean | null;
          replied?: boolean | null;
          created_at?: string;
        };
      };
      newsletter_subscribers: {
        Row: {
          id: string;
          email: string;
          active: boolean;
          source: string;
          subscribed_at: string;
          unsubscribed_at: string | null;
        };
        Insert: {
          id?: string;
          email: string;
          active?: boolean;
          source?: string;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          active?: boolean;
          source?: string;
          subscribed_at?: string;
          unsubscribed_at?: string | null;
        };
      };
      ai_conversations: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          session_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          session_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      ai_messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: 'user' | 'assistant' | 'system';
          content: string;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: 'user' | 'assistant' | 'system';
          content?: string;
          metadata?: Json;
          created_at?: string;
        };
      };
      ai_feedback: {
        Row: {
          id: string;
          message_id: string;
          user_id: string | null;
          rating: number | null;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          message_id: string;
          user_id?: string | null;
          rating?: number | null;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          message_id?: string;
          user_id?: string | null;
          rating?: number | null;
          comment?: string | null;
          created_at?: string;
        };
      };
      ai_logs: {
        Row: {
          id: string;
          user_id: string | null;
          conversation_id: string | null;
          question_type: string | null;
          query: string;
          response_time_ms: number | null;
          tokens_used: number | null;
          model: string | null;
          success: boolean | null;
          error_message: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          conversation_id?: string | null;
          question_type?: string | null;
          query: string;
          response_time_ms?: number | null;
          tokens_used?: number | null;
          model?: string | null;
          success?: boolean | null;
          error_message?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          conversation_id?: string | null;
          question_type?: string | null;
          query?: string;
          response_time_ms?: number | null;
          tokens_used?: number | null;
          model?: string | null;
          success?: boolean | null;
          error_message?: string | null;
          created_at?: string;
        };
      };
      ai_settings: {
        Row: {
          id: string;
          setting_key: string;
          setting_value: string;
          description: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id?: string;
          setting_key: string;
          setting_value: string;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: string;
          setting_key?: string;
          setting_value?: string;
          description?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
      };
      ai_file_uploads: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string | null;
          file_name: string;
          file_type: string;
          file_size: number | null;
          file_url: string | null;
          analysis_result: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          user_id?: string | null;
          file_name: string;
          file_type: string;
          file_size?: number | null;
          file_url?: string | null;
          analysis_result?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          user_id?: string | null;
          file_name?: string;
          file_type?: string;
          file_size?: number | null;
          file_url?: string | null;
          analysis_result?: Json;
          created_at?: string;
        };
      };
      accounting_reports: {
        Row: {
          id: string;
          report_month: string;
          report_year: number;
          report_type: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          status: string;
          generated_at: string;
          generated_by: string | null;
          sent_to: string[] | null;
          sent_at: string | null;
          metadata: Json;
          summary: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_month: string;
          report_year: number;
          report_type?: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          status?: string;
          generated_at?: string;
          generated_by?: string | null;
          sent_to?: string[] | null;
          sent_at?: string | null;
          metadata?: Json;
          summary?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_month?: string;
          report_year?: number;
          report_type?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          status?: string;
          generated_at?: string;
          generated_by?: string | null;
          sent_to?: string[] | null;
          sent_at?: string | null;
          metadata?: Json;
          summary?: Json;
          created_at?: string;
        };
      };
      report_schedules: {
        Row: {
          id: string;
          schedule_type: string;
          active: boolean | null;
          last_run: string | null;
          next_run: string | null;
          config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          schedule_type: string;
          active?: boolean | null;
          last_run?: string | null;
          next_run?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          schedule_type?: string;
          active?: boolean | null;
          last_run?: string | null;
          next_run?: string | null;
          config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      report_recipients: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          active: boolean | null;
          reports: string[] | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          active?: boolean | null;
          reports?: string[] | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          active?: boolean | null;
          reports?: string[] | null;
          created_at?: string;
        };
      };
      financial_cache: {
        Row: {
          id: string;
          cache_key: string;
          cache_data: Json;
          period_start: string;
          period_end: string;
          created_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          cache_key: string;
          cache_data: Json;
          period_start: string;
          period_end: string;
          created_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          cache_key?: string;
          cache_data?: Json;
          period_start?: string;
          period_end?: string;
          created_at?: string;
          expires_at?: string | null;
        };
      };
      executive_reports: {
        Row: {
          id: string;
          report_month: string;
          report_year: number;
          title: string;
          summary: string;
          full_report: Json;
          scores: Json;
          recommendations: Json;
          risks: Json;
          forecast: Json;
          insights: Json;
          notifications: Json;
          status: string;
          generated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_month: string;
          report_year: number;
          title: string;
          summary: string;
          full_report?: Json;
          scores?: Json;
          recommendations?: Json;
          risks?: Json;
          forecast?: Json;
          insights?: Json;
          notifications?: Json;
          status?: string;
          generated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_month?: string;
          report_year?: number;
          title?: string;
          summary?: string;
          full_report?: Json;
          scores?: Json;
          recommendations?: Json;
          risks?: Json;
          forecast?: Json;
          insights?: Json;
          notifications?: Json;
          status?: string;
          generated_at?: string;
          created_at?: string;
        };
      };
      ai_scores_history: {
        Row: {
          id: string;
          report_id: string | null;
          report_month: string;
          financial_health: number;
          production_efficiency: number;
          warehouse_management: number;
          customer_satisfaction: number;
          business_growth: number;
          overall_score: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id?: string | null;
          report_month: string;
          financial_health?: number;
          production_efficiency?: number;
          warehouse_management?: number;
          customer_satisfaction?: number;
          business_growth?: number;
          overall_score?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string | null;
          report_month?: string;
          financial_health?: number;
          production_efficiency?: number;
          warehouse_management?: number;
          customer_satisfaction?: number;
          business_growth?: number;
          overall_score?: number;
          created_at?: string;
        };
      };
      ai_notifications: {
        Row: {
          id: string;
          report_id: string | null;
          type: string;
          title: string;
          message: string;
          priority: string;
          read: boolean | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_id?: string | null;
          type: string;
          title: string;
          message: string;
          priority?: string;
          read?: boolean | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_id?: string | null;
          type?: string;
          title?: string;
          message?: string;
          priority?: string;
          read?: boolean | null;
          created_at?: string;
        };
      };
      monthly_trends: {
        Row: {
          id: string;
          report_month: string;
          revenue: number;
          expenses: number;
          profit: number;
          orders: number;
          customers_new: number;
          production_hours: number;
          utilization: number;
          margin: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          report_month: string;
          revenue?: number;
          expenses?: number;
          profit?: number;
          orders?: number;
          customers_new?: number;
          production_hours?: number;
          utilization?: number;
          margin?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          report_month?: string;
          revenue?: number;
          expenses?: number;
          profit?: number;
          orders?: number;
          customers_new?: number;
          production_hours?: number;
          utilization?: number;
          margin?: number;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_order_quote: {
        Args: { p_order_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

// Convenience type aliases
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Material = Database['public']['Tables']['materials']['Row'];
export type MaterialColor = Database['public']['Tables']['material_colors']['Row'];
export type Product = Database['public']['Tables']['products']['Row'];
export type Category = Database['public']['Tables']['categories']['Row'];
export type Order3D = Database['public']['Tables']['orders_3d']['Row'];
export type Filament = Database['public']['Tables']['filaments']['Row'];
export type WarehouseItem = Database['public']['Tables']['warehouse_items']['Row'];
export type StoreOrder = Database['public']['Tables']['store_orders']['Row'];
export type CartItem = Database['public']['Tables']['cart_items']['Row'];
export type WishlistItem = Database['public']['Tables']['wishlist_items']['Row'];
export type BlogPost = Database['public']['Tables']['blog_posts']['Row'];
export type FAQItem = Database['public']['Tables']['faq_items']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type Settings = Database['public']['Tables']['settings']['Row'];
export type DiscountCode = Database['public']['Tables']['discount_codes']['Row'];
export type PortfolioItem = Database['public']['Tables']['portfolio_items']['Row'];
export type ContactSubmission = Database['public']['Tables']['contact_submissions']['Row'];
export type NewsletterSubscriber = Database['public']['Tables']['newsletter_subscribers']['Row'];
export type AIConversation = Database['public']['Tables']['ai_conversations']['Row'];
export type AIMessage = Database['public']['Tables']['ai_messages']['Row'];
export type AIFeedback = Database['public']['Tables']['ai_feedback']['Row'];
export type AILog = Database['public']['Tables']['ai_logs']['Row'];
export type AISettings = Database['public']['Tables']['ai_settings']['Row'];
export type AIFileUpload = Database['public']['Tables']['ai_file_uploads']['Row'];
export type AccountingReport = Database['public']['Tables']['accounting_reports']['Row'];
export type ReportSchedule = Database['public']['Tables']['report_schedules']['Row'];
export type ReportRecipient = Database['public']['Tables']['report_recipients']['Row'];
export type FinancialCache = Database['public']['Tables']['financial_cache']['Row'];
export type ExecutiveReport = Database['public']['Tables']['executive_reports']['Row'];
export type AIScoresHistory = Database['public']['Tables']['ai_scores_history']['Row'];
export type AINotification = Database['public']['Tables']['ai_notifications']['Row'];
export type MonthlyTrend = Database['public']['Tables']['monthly_trends']['Row'];
