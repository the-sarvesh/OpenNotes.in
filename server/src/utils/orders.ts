import db from '../db/database.js';
import { getSetting } from './settings.js';

// Returns { valid, discountType, discountValue, feeWaived, finalFee, message }
export const applyCoupon = async (
  code: string,
  originalFee: number,
): Promise<{
  valid: boolean;
  discountType: string;
  discountValue: number;
  feeWaived: boolean;
  finalFee: number;
  couponId: string;
  message: string;
}> => {
  const result = await db.execute({
    sql: `SELECT * FROM coupon_codes
          WHERE code = ?
            AND is_active = 1
            AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
            AND (max_uses IS NULL OR used_count < max_uses)`,
    args: [code.toUpperCase().trim()],
  });

  if (result.rows.length === 0) {
    return {
      valid: false,
      discountType: "percentage",
      discountValue: 0,
      feeWaived: false,
      finalFee: originalFee,
      couponId: "",
      message: "Invalid, expired, or already fully used coupon code.",
    };
  }

  const coupon = result.rows[0] as any;
  let finalFee = originalFee;
  let feeWaived = false;

  if (coupon.discount_type === "percentage") {
    const discount = Math.round(originalFee * (coupon.discount_value / 100));
    finalFee = Math.max(0, originalFee - discount);
    if (coupon.discount_value >= 100) feeWaived = true;
  } else if (coupon.discount_type === "fixed") {
    finalFee = Math.max(0, originalFee - coupon.discount_value);
    if (finalFee === 0) feeWaived = true;
  }

  return {
    valid: true,
    discountType: coupon.discount_type,
    discountValue: coupon.discount_value,
    feeWaived,
    finalFee,
    couponId: coupon.id,
    message: feeWaived
      ? "✅ Platform fee fully waived!"
      : `✅ Coupon applied — fee reduced to ₹${finalFee}.`,
  };
};

/**
 * Shared utility to calculate platform fees and apply coupons consistently.
 */
export const calculateOrderFees = async (subtotal: number, couponCode?: string) => {
  const feePercentage = Number(await getSetting("platform_fee_percentage", "0"));
  const rawFee = Math.round(subtotal * (feePercentage / 100));
  
  if (!couponCode || !couponCode.trim()) {
    return {
      subtotal,
      rawPlatformFee: rawFee,
      platformFee: rawFee,
      feeWaived: false,
      appliedCouponCode: null,
      couponId: null,
      couponValid: true,
      couponMessage: null
    };
  }

  const result = await applyCoupon(couponCode, rawFee);
  return {
    subtotal,
    rawPlatformFee: rawFee,
    platformFee: result.valid ? result.finalFee : rawFee,
    feeWaived: result.valid ? result.feeWaived : false,
    appliedCouponCode: result.valid ? couponCode.toUpperCase().trim() : null,
    couponId: result.valid ? result.couponId : null,
    couponValid: result.valid,
    couponMessage: result.message
  };
};
