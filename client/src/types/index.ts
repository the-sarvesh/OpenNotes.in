import type { Note } from '../components/NoteCard';
export type { Note };


export type View = 'home' | 'browse' | 'sell' | 'profile' | 'admin' | 'messages' | 'orders' | 'cart' | 'checkout' | 'order-success';

export interface Listing extends Note {
  seller_id: string;
  seller_name?: string;
  status: 'active' | 'sold' | 'archived';
}

export interface CartItem {
  note: Note;
  quantity: number;
}


export interface Order {
  id: string;
  buyer_id: string;
  status: 'pending_meetup' | 'completed' | 'cancelled';
  total_amount: number;
  platform_fee: number;
  platform_fee_waived: number;
  coupon_code?: string;
  created_at: string;
  items: OrderItem[];
  delivery_details?: string;
  collection_date?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  listing_id: string;
  seller_id: string;
  quantity: number;
  price_at_purchase: number;
  status: string;
  meetup_pin: string;
  title: string;
  image_url: string;
  course_code?: string;
  seller_name?: string;
  seller_email?: string;
  meetup_location?: string;
  condition?: string;
  semester?: string;
  delivery_method?: string;
  material_type?: string;
  location?: string;
}


export interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  listing_id?: string;
  is_read: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  is_read: number;
  created_at: string;
}
