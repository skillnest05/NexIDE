import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const config = { api: { bodyParser: false } };

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method not allowed');
  }

  try {
    const rawBody = await getRawBody(req);
    const receivedSignature = req.headers['x-razorpay-signature'];
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (!secret || !receivedSignature) {
      return res.status(400).send('Missing signature or secret');
    }

    const expectedSignature = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (expectedSignature !== receivedSignature) {
      return res.status(401).send('Invalid signature');
    }

    const event = JSON.parse(rawBody);

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity;
      const userId = payment.notes?.userId;
      const tokens = parseInt(payment.notes?.tokens || '0', 10);
      const amountPaise = payment.amount;
      const razorpay_payment_id = payment.id;
      const razorpay_order_id = payment.order_id;

      if (!userId || !tokens) {
        return res.status(400).send('Missing userId or tokens in notes');
      }

      // Check idempotency
      const { data: existingPurchase } = await supabaseAdmin
        .from('token_purchases')
        .select('id')
        .eq('razorpay_payment_id', razorpay_payment_id)
        .single();

      if (existingPurchase) {
        return res.status(200).send('Already processed');
      }

      // Insert purchase
      const { error: insertError } = await supabaseAdmin
        .from('token_purchases')
        .insert({
          user_id: userId,
          tokens,
          amount_paise: amountPaise,
          razorpay_payment_id,
          razorpay_order_id
        });

      if (insertError) {
        console.error('Insert error', insertError);
        return res.status(500).send('Database error');
      }

      // Update user credits
      const { data: creditsData } = await supabaseAdmin
        .from('user_credits')
        .select('balance, lifetime_purchased')
        .eq('user_id', userId)
        .single();

      if (creditsData) {
        await supabaseAdmin
          .from('user_credits')
          .update({
            balance: (creditsData.balance || 0) + tokens,
            lifetime_purchased: (creditsData.lifetime_purchased || 0) + tokens
          })
          .eq('user_id', userId);
      } else {
        await supabaseAdmin
          .from('user_credits')
          .insert({
            user_id: userId,
            balance: 1000 + tokens,
            lifetime_purchased: tokens,
            lifetime_used: 0
          });
      }
    }

    return res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    return res.status(500).send('Internal server error');
  }
}
