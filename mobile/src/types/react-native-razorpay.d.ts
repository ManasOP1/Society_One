declare module 'react-native-razorpay' {
  export type RazorpaySuccessData = {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  };

  export type RazorpayOpenOptions = {
    key: string;
    amount: number;
    currency?: string;
    name?: string;
    description?: string;
    order_id?: string;
    prefill?: { email?: string; contact?: string; name?: string };
    theme?: { color?: string; backdrop_color?: string };
  };

  const RazorpayCheckout: {
    open(options: RazorpayOpenOptions): Promise<RazorpaySuccessData>;
  };

  export default RazorpayCheckout;
}
