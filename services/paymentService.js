// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// async function createPaymentIntent(amount, currency = 'inr') {
//     try {
//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: amount * 100, // Stripe expects amount in cents/paise
//             currency: currency,
//             automatic_payment_methods: {
//                 enabled: true,
//             },
//         });
//         return paymentIntent;
//     } catch (error) {
//         console.error('Error creating payment intent:', error);
//         throw error;
//     }
// }

// module.exports = { createPaymentIntent };

const Razorpay = require("razorpay");

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

async function createPaymentIntent(amount, currency = "INR") {
    try {
        const options = {
            amount: amount * 100, // Razorpay expects amount in paise
            currency,
            receipt: "receipt_" + Date.now(),
            payment_capture: 1 // auto capture
        };

        const order = await razorpay.orders.create(options);

        return order; // This is equivalent to Stripe's PaymentIntent
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        throw error;
    }
}

module.exports = { createPaymentIntent };

