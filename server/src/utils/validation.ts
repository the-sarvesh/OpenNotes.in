export const normalizeEmail = (value: unknown): string =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

export const isValidEmail = (value: string): boolean =>
  value.length > 3 && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export interface NormalizedOrderItem {
  listing_id: string;
  quantity: number;
}

export const normalizeOrderItems = (
  value: unknown,
): { items: NormalizedOrderItem[]; error?: string } => {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) {
    return { items: [], error: "Order items are required (maximum 20)." };
  }

  const quantitiesByListing = new Map<string, number>();
  for (const item of value) {
    const listingId = String(item?.listing_id || "").trim();
    const quantity = Number(item?.quantity);
    if (
      !listingId ||
      listingId.length > 128 ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100
    ) {
      return { items: [], error: "Each item must have a valid listing and quantity between 1 and 100." };
    }
    const combinedQuantity = (quantitiesByListing.get(listingId) || 0) + quantity;
    if (combinedQuantity > 100) {
      return { items: [], error: "The combined quantity for one listing cannot exceed 100." };
    }
    quantitiesByListing.set(listingId, combinedQuantity);
  }

  return {
    items: [...quantitiesByListing.entries()].map(([listing_id, quantity]) => ({ listing_id, quantity })),
  };
};
