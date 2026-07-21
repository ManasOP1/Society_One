/**
 * Opens Razorpay Checkout on native (Android/iOS).
 * Requires a dev build — `npx expo run:android` / `run:ios` — not Expo Go.
 */

import { Platform } from 'react-native';

export type RazorpayCheckoutResult = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type OpenRazorpayCheckoutInput = {
  keyId: string;
  orderId: string;
  amountPaise: number;
  societyName: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
};

export function isRazorpayCheckoutAvailable(): boolean {
  if (Platform.OS === 'web') return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('react-native-razorpay');
    return true;
  } catch {
    return false;
  }
}

export async function openRazorpayCheckout(
  input: OpenRazorpayCheckoutInput,
): Promise<RazorpayCheckoutResult> {
  if (Platform.OS === 'web') {
    throw new Error('Razorpay Checkout is not available on web. Use the mobile app.');
  }

  let RazorpayCheckout: {
    open: (options: Record<string, unknown>) => Promise<RazorpayCheckoutResult>;
  };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    RazorpayCheckout = require('react-native-razorpay').default;
  } catch {
    throw new Error(
      'Razorpay native module not found. Build the app with `npx expo run:android` or `npx expo run:ios` (Expo Go does not include Razorpay).',
    );
  }

  const result = await RazorpayCheckout.open({
    key: input.keyId,
    order_id: input.orderId,
    amount: input.amountPaise,
    currency: 'INR',
    name: input.societyName || 'SocietyOne',
    description: input.description,
    prefill: {
      name: input.prefill?.name ?? '',
      email: input.prefill?.email ?? '',
      contact: input.prefill?.contact ?? '',
    },
    theme: { color: '#22C55E', backdrop_color: '#131417' },
  });

  return result;
}

/** User dismissed checkout without paying. */
export function isRazorpayCancelled(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = (error as { code?: number }).code;
  const description = String((error as { description?: string }).description ?? '').toLowerCase();
  return code === 0 || code === 2 || description.includes('cancel');
}
