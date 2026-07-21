/** Test Razorpay test-mode keys by creating a ₹1 order. */
require('dotenv').config();
const Razorpay = require('razorpay');

async function main() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    console.error('RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing in api/.env');
    process.exit(1);
  }
  if (keyId.includes('placeholder')) {
    console.error('Razorpay keys are still placeholders');
    process.exit(1);
  }

  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  const order = await client.orders.create({
    amount: 100,
    currency: 'INR',
    receipt: `test-${Date.now()}`.slice(0, 40),
    payment_capture: true,
  });

  console.log('Razorpay OK — test order created');
  console.log('  key_id:', keyId);
  console.log('  order_id:', order.id);
  console.log('  amount:', order.amount, 'paise');
  console.log('  status:', order.status);
}

main().catch((e) => {
  console.error('Razorpay FAILED:', e.error?.description || e.message || e);
  process.exit(1);
});
