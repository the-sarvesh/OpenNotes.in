import type { Note } from '../types';

/**
 * Maps a raw database listing item to the Note type used by the frontend.
 */
export function mapListing(item: any): Note {
  return {
    id: item.id || item.listing_id,
    title: item.title,
    description: item.description || '',
    price: Number(item.price || item.listing_price || 0),
    quantity: Number(item.quantity ?? 0),
    seller: item.seller_name || item.seller_email || 'User',
    sellerId: item.seller_id,
    courseCode: item.course_code || 'BITS',
    image: item.image_url || 'https://via.placeholder.com/300?text=Notes',
    rating: Number(item.seller_rating || 0),
    condition: item.condition || 'Good',
    semester: item.semester || 'Any',
    materialType: item.material_type || 'Mixed',
    location: item.location || 'Pilani',
    images: item.images || (item.image_url ? [item.image_url] : []),
    deliveryMethod: item.delivery_method || 'in_person',
    preferredMeetupSpot: item.preferred_meetup_spot || null,
    meetupLocation: item.meetup_location || null,
    views: Number(item.views || 0),
    isMultipleSubjects: Boolean(item.is_multiple_subjects),
    subjects: Array.isArray(item.subjects) ? item.subjects : [],
    originalPrice: item.original_price ? Number(item.original_price) : undefined,
  };
}
