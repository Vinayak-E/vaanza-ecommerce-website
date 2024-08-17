const User = require("../models/userModel");
const Order = require("../models/orderModel");
const Cart = require("../models/cartSchema");
const Address = require("../models/addressSchema")
const Product = require("../models/productSchema");
const Offer = require("../models/offerModel");
const Coupon = require("../models/couponModel");
const Wallet = require("../models/walletModel");
const crypto = require('crypto');
const Razorpay = require('razorpay');



const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// const placeOrder = async (req, res) => {
//   try {
//       const userId = req.session.user._id;
//       const { addressId, paymentMethod, couponCode } = req.body;

//       console.log('Received order data:', { userId, addressId, paymentMethod, couponCode });

//       const address = await Address.findById(addressId);
//       if (!address) {
//           return res.status(400).json({ success: false, message: 'Address not found.' });
//       }

//       const cart = await Cart.findOne({ userId }).populate({
//           path: 'products.productId',
//           populate: {
//               path: 'category'
//           }
//       });
//       if (!cart) {
//           return res.status(400).json({ success: false, message: 'Cart not found.' });
//       }

//       const filteredProducts = cart.products.filter(item => item.quantity > 0);

//       let shippingCharge = 50;
//       let subtotal = 0;

//       const products = await Promise.all(filteredProducts.map(async item => {
//           const product = item.productId;
//           const variant = item.variantId;

//           const offers = await Offer.find({
//               $or: [
//                   { 'products.productId': product._id },
//                   { 'category.category': product.category }
//               ],
//               status: true
//           });

//           const bestOffer = offers.reduce((best, offer) =>
//               offer.discount > best.discount ? offer : best, { discount: 0 }
//           );

//           const finalPrice = product.price * (1 - bestOffer.discount / 100);
//           const itemTotal = finalPrice * item.quantity;

//           subtotal += itemTotal;
//           const status = "Pending";

//           return {
//               productId: product._id,
//               variantId: variant._id,
//               quantity: item.quantity,
//               size: item.size,
//               price: finalPrice,
//               status
//           };
//       }));

//       let couponDiscount = 0;
//       let coupon = null;
//       if (couponCode && typeof couponCode === 'string') {
//           const couponDoc = await Coupon.findOne({ couponId: couponCode });
//           if (couponDoc) {
//               coupon = {
//                   code: couponDoc.couponId,
//                   discount: couponDoc.discount,
//                   description: couponDoc.description,
//                   minPurchase: couponDoc.minPurchaseAmount,
//                   maxAmount: couponDoc.maxAmount,
//                   validity: couponDoc.validity
//               };
//               couponDiscount = subtotal * coupon.discount / 100;
//               if (coupon.maxAmount && couponDiscount > coupon.maxAmount) {
//                   couponDiscount = coupon.maxAmount;
//               }
//           }
//       }

//       const finalShippingCharge = subtotal > 500 ? 0 : shippingCharge;
//       const totalAmount = subtotal - couponDiscount + finalShippingCharge;

//       if (isNaN(totalAmount) || totalAmount < 0) {
//           throw new Error(`Total amount calculation failed. Subtotal: ${subtotal}, Coupon Discount: ${couponDiscount}, Shipping Charge: ${shippingCharge}, Total Amount: ${totalAmount}`);
//       }

//        // Check if payment method is COD and totalAmount is less than 1000
//     if (paymentMethod === 'Cash on Delivery' && totalAmount > 1000) {
//         return res.status(400).json({
//           success: false,
//           message: 'Order total is less than 1000. Please choose a different payment method.',
//         });
//       }
  

//       for (let i = 0; i < products.length; i++) {
//           const orderedProduct = products[i];
//           const product = await Product.findById(orderedProduct.productId);
//           if (product) {
//               const variant = product.variants.find(v => v.sizes.includes(orderedProduct.size));
//               if (variant) {
//                   variant.quantity -= orderedProduct.quantity;
//                   await product.save();
//               }
//           }
//       }

//       function generateRandomId(length) {
//           const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
//           let result = '';
//           const randomValues = new Uint8Array(length);
//           crypto.randomFillSync(randomValues);

//           for (let i = 0; i < length; i++) {
//               result += charset[randomValues[i] % charset.length];
//           }
//           return result;
//       }

//       const orderId = generateRandomId(10);
//       let paymentStatus;

//       if (paymentMethod === 'Cash on Delivery') {
//           paymentStatus = "Pending";
//       } else if (paymentMethod === 'Razor pay') {
//           paymentStatus ? "Paid" : "Failed";
//       } else {
//           paymentStatus = "Paid";
//       }
      
//       const newOrder = new Order({
//           orderId,
//           userId,
//           address: {
//               name: address.name,
//               number: address.number,
//               address: address.address,
//               street: address.street,
//               postalCode: address.postalCode,
//               state: address.state,
//               landmark: address.landmark
//           },
//           products,
//           coupon,
//           totalAmount,
//           orderDate: new Date(),
//           paymentMethod,
//           paymentStatus,
//           shippingCharge: finalShippingCharge
//       });

//       await newOrder.save();

//       if (paymentMethod === 'Razor pay') {
//           const amountInPaise = Math.round(totalAmount * 100);
//           console.log('Creating Razorpay order with amount:', amountInPaise);

//           try {
//               const razorpayOrder = await razorpay.orders.create({
//                   amount: amountInPaise,
//                   currency: 'INR',
//                   receipt: orderId,
//                   payment_capture: 1
//               });

//               console.log('Razorpay order created:', razorpayOrder);

//               newOrder.razorpayOrderId = razorpayOrder.id;
//               await newOrder.save();

//               return res.json({
//                   success: true,
//                   orderId: newOrder._id,
//                   razorpayOrderId: razorpayOrder.id,
//                   amount: amountInPaise,
//                   currency: 'INR',
//                   keyId: process.env.RAZORPAY_KEY_ID,
//                   user: {
//                       id: userId,
//                       email: req.session.user.email,
//                   },
//               });
//           } catch (razorpayError) {
//               console.error('Razorpay order creation failed:', razorpayError);
//               return res.status(500).json({ success: false, message: 'Failed to create Razorpay order.', error: razorpayError.message });
//           }
//       } else {
//           await Cart.findOneAndUpdate({ userId }, { $set: { products: [] } });
//           return res.json({ 
//               success: true, 
//               orderId: newOrder._id,
//               message: "Order placed successfully",
//           });
//       }

//   } catch (error) {
//       console.error('Error placing order:', error);
//       res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
//   }
// };


const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId, paymentMethod, couponCode } = req.body;
  
        console.log('Received order data:', { userId, addressId, paymentMethod, couponCode });
  
        const address = await Address.findById(addressId);
        if (!address) {
            return res.status(400).json({ success: false, message: 'Address not found.' });
        }
  
        const cart = await Cart.findOne({ userId }).populate({
            path: 'products.productId',
            populate: {
                path: 'category'
            }
        });
        if (!cart) {
            return res.status(400).json({ success: false, message: 'Cart not found.' });
        }
  
        const filteredProducts = cart.products.filter(item => item.quantity > 0);
  
        let shippingCharge = 50;
        let subtotal = 0;
  
        let coupon = null;
        if (couponCode && typeof couponCode === 'string') {
            const couponDoc = await Coupon.findOne({ couponId: couponCode });
            if (couponDoc) {
                coupon = {
                    code: couponDoc.couponId,
                    discount: couponDoc.discount,
                    description: couponDoc.description,
                    minPurchase: couponDoc.minPurchaseAmount,
                    maxAmount: couponDoc.maxAmount,
                    validity: couponDoc.validity
                };
            }
        }
  
        const products = await Promise.all(filteredProducts.map(async item => {
            const product = item.productId;
            const variant = item.variantId;
  
            const offers = await Offer.find({
                $or: [
                    { 'products.productId': product._id },
                    { 'category.category': product.category }
                ],
                status: true
            });
  
            const bestOffer = offers.reduce((best, offer) =>
                offer.discount > best.discount ? offer : best, { discount: 0 }
            );
  
            const finalPrice = product.price * (1 - bestOffer.discount / 100);
            const itemTotal = finalPrice * item.quantity;
  
            subtotal += itemTotal;
            const status = "Pending";
  
            // Calculate couponPrice
            let couponPrice = finalPrice;
            if (coupon) {
                const itemCouponDiscount = finalPrice * coupon.discount / 100;
                if (coupon.maxAmount) {
                    couponPrice = Math.max(finalPrice - Math.min(itemCouponDiscount, coupon.maxAmount / cart.products.length), 0);
                } else {
                    couponPrice = Math.max(finalPrice - itemCouponDiscount, 0);
                }
            }
  
            return {
                productId: product._id,
                variantId: variant._id,
                quantity: item.quantity,
                size: item.size,
                price: finalPrice,
                couponPrice: couponPrice,
                status
            };
        }));
  
        let couponDiscount = 0;
        if (coupon) {
            couponDiscount = subtotal * coupon.discount / 100;
            if (coupon.maxAmount && couponDiscount > coupon.maxAmount) {
                couponDiscount = coupon.maxAmount;
            }
        }
  
        const finalShippingCharge = subtotal > 500 ? 0 : shippingCharge;
        const totalAmount = subtotal - couponDiscount + finalShippingCharge;
  
        if (isNaN(totalAmount) || totalAmount < 0) {
            throw new Error(`Total amount calculation failed. Subtotal: ${subtotal}, Coupon Discount: ${couponDiscount}, Shipping Charge: ${shippingCharge}, Total Amount: ${totalAmount}`);
        }
  
        // Check if payment method is COD and totalAmount is more than 1000
        if (paymentMethod === 'Cash on Delivery' && totalAmount > 1000) {
            return res.status(400).json({
              success: false,
              message: 'Order total is more than 1000. Please choose a different payment method.',
            });
        }
  
        for (let i = 0; i < products.length; i++) {
            const orderedProduct = products[i];
            const product = await Product.findById(orderedProduct.productId);
            if (product) {
                const variant = product.variants.find(v => v.sizes.includes(orderedProduct.size));
                if (variant) {
                    variant.quantity -= orderedProduct.quantity;
                    await product.save();
                }
            }
        }
  
        function generateRandomId(length) {
            const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
            let result = '';
            const randomValues = new Uint8Array(length);
            crypto.randomFillSync(randomValues);
  
            for (let i = 0; i < length; i++) {
                result += charset[randomValues[i] % charset.length];
            }
            return result;
        }
  
        const orderId = generateRandomId(10);
        let paymentStatus;
  
        if (paymentMethod === 'Cash on Delivery') {
            paymentStatus = "Pending";
        } else if (paymentMethod === 'Razor pay') {
            paymentStatus = "Paid";
        } else {
            paymentStatus = "Paid";
        }
        
        const newOrder = new Order({
            orderId,
            userId,
            address: {
                name: address.name,
                number: address.number,
                address: address.address,
                street: address.street,
                postalCode: address.postalCode,
                state: address.state,
                landmark: address.landmark
            },
            products,
            coupon,
            totalAmount,
            orderDate: new Date(),
            paymentMethod,
            paymentStatus,
            shippingCharge: finalShippingCharge
        });
  
        await newOrder.save();
  
        if (paymentMethod === 'Razor pay') {
            const amountInPaise = Math.round(totalAmount * 100);
            console.log('Creating Razorpay order with amount:', amountInPaise);
  
            try {
                const razorpayOrder = await razorpay.orders.create({
                    amount: amountInPaise,
                    currency: 'INR',
                    receipt: orderId,
                    payment_capture: 1
                });
  
                console.log('Razorpay order created:', razorpayOrder);
  
                newOrder.razorpayOrderId = razorpayOrder.id;
                await newOrder.save();
  
                return res.json({
                    success: true,
                    orderId: newOrder._id,
                    razorpayOrderId: razorpayOrder.id,
                    amount: amountInPaise,
                    currency: 'INR',
                    keyId: process.env.RAZORPAY_KEY_ID,
                    user: {
                        id: userId,
                        email: req.session.user.email,
                    },
                });
            } catch (razorpayError) {
                console.error('Razorpay order creation failed:', razorpayError);
                return res.status(500).json({ success: false, message: 'Failed to create Razorpay order.', error: razorpayError.message });
            }
        } else {
            await Cart.findOneAndUpdate({ userId }, { $set: { products: [] } });
            return res.json({ 
                success: true, 
                orderId: newOrder._id,
                message: "Order placed successfully",
            });
        }
  
    } catch (error) {
        console.error('Error placing order:', error);
        res.status(500).json({ success: false, message: 'Internal server error.', error: error.message });
    }
  }
  

const updatePaymentStatus = async (req, res) => {
  try {
      const { orderId, status, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
      const order = await Order.findById(orderId);

      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found.' });
      }

      order.paymentStatus = status;

      if (status === 'Paid' && razorpay_payment_id && razorpay_order_id && razorpay_signature) {
          order.razorpay_payment_id = razorpay_payment_id;
          order.razorpay_order_id = razorpay_order_id;
          order.razorpay_signature = razorpay_signature;
      }

      await order.save();

      if (status === 'Paid') {
          await Cart.findOneAndUpdate({ userId: order.userId }, { $set: { products: [] } });
      }

      res.json({ success: true, message: 'Payment status updated successfully.' });
  } catch (error) {
      console.error('Error updating payment status:', error);
      res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};




const loadOrders = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            req.flash("error", "Please log in to view your orders.");
            return res.redirect("/login");
        }

        const userId = req.session.user._id;

        // Fetch the user's orders
        
        // Render the orders view
        res.render("profile", { orders });
    } catch (err) {
        console.error('Error loading orders:', err.message);
        res.status(500).send("An error occurred while loading orders.");
    }
};


// const cancelOrder = async (req, res) => {
//   try {
//       const { orderId, productId, variantId, cancelReason } = req.body;
//       const user = req.session.user;

//       const order = await Order.findById(orderId);
//       if (!order) {
//           return res.status(404).json({ message: 'Order not found' });
//       }

//       // Find the product within the order
//       const product = order.products.find(prod => prod.productId.equals(productId) && prod.variantId.equals(variantId));
//       if (!product) {
//           return res.status(404).json({ message: 'Product not found in the order' });
//       }

//       // Check if the product is already delivered
//       if (product.status === 'Delivered') {
//           return res.status(400).json({ message: 'Cannot cancel a product that is already delivered' });
//       }

//       // Update the product status and cancellation reason
//       product.status = 'Cancelled';
//       product.cancelReason = cancelReason;

//       // Save the order
//       await order.save();

//       // Add money to wallet only if payment method is Razorpay
//       if (order.paymentMethod === 'Razor pay') {
//           const productPurchasePrice = product.price;
//           const productQuantity = product.quantity;
//           const totalAmount = productPurchasePrice * productQuantity; // Total amount to credit

//           let wallet = await Wallet.findOne({ user: user._id });

//           if (!wallet) {
//               // Create a new wallet if it doesn't exist
//               wallet = new Wallet({
//                   user: user._id,
//                   balance: 0,
//                   transactions: []
//               });
//           }

//           const productDetails = await Product.findById(productId);

//           // Update the wallet balance
//           wallet.balance += totalAmount;

//           // Add the transaction to the wallet
//           wallet.transactions.push({
//               amount: totalAmount,
//               transactionId: `Cancel Order : ${orderId}`,
//               productName: productDetails.name,
//               type: 'credit'
//           });

//           // Save the wallet with the updated balance and transaction
//           await wallet.save();
//       }

//       // Restock the product variant
//       const mainProduct = await Product.findById(productId);
//       const variant = mainProduct.variants.id(variantId);
//       if (variant) {
//           variant.quantity += product.quantity;
//           await mainProduct.save();
//       }

//       res.status(200).json({ message: 'Product cancelled and stock updated successfully' });
//   } catch (error) {
//       console.error(error.message);
//       res.status(500).json({ message: 'Server Error' });
//   }
// };

const cancelOrder = async (req, res) => {
    try {
        const { orderId, productId, variantId, cancelReason } = req.body;
        const user = req.session.user;
  
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
  
        // Find the product within the order
        const product = order.products.find(prod => prod.productId.equals(productId) && prod.variantId.equals(variantId));
        if (!product) {
            return res.status(404).json({ message: 'Product not found in the order' });
        }
  
        // Check if the product is already delivered
        if (product.status === 'Delivered') {
            return res.status(400).json({ message: 'Cannot cancel a product that is already delivered' });
        }
  
        // Update the product status and cancellation reason
        product.status = 'Cancelled';
        product.cancelReason = cancelReason;
  
        // Save the order
        await order.save();
  
        // Add money to wallet only if payment method is Razorpay
        if (order.paymentMethod === 'Razor pay') {
            const totalAmount = product.couponPrice * product.quantity; // Use couponPrice for refund calculation
  
            let wallet = await Wallet.findOne({ user: user._id });
  
            if (!wallet) {
                // Create a new wallet if it doesn't exist
                wallet = new Wallet({
                    user: user._id,
                    balance: 0,
                    transactions: []
                });
            }
  
            const productDetails = await Product.findById(productId);
  
            // Update the wallet balance
            wallet.balance += totalAmount;
  
            // Add the transaction to the wallet
            wallet.transactions.push({
                amount: totalAmount,
                transactionId: `Cancel Order : ${orderId}`,
                productName: productDetails.name,
                type: 'credit'
            });
  
            // Save the wallet with the updated balance and transaction
            await wallet.save();
        }
  
        // Restock the product variant
        const mainProduct = await Product.findById(productId);
        const variant = mainProduct.variants.id(variantId);
        if (variant) {
            variant.quantity += product.quantity;
            await mainProduct.save();
        }
  
        res.status(200).json({ message: 'Product cancelled and stock updated successfully' });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server Error' });
    }
  };
  

  const returnOrder = async (req, res) => {
    try {
      const { orderId, productId, variantId, returnReason } = req.body;
  
      const order = await Order.findById(orderId);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }
  
      const product = order.products.find(prod => prod.productId.equals(productId) && prod.variantId.equals(variantId));
      if (!product) {
        return res.status(404).json({ message: 'Product not found in the order' });
      }
  
      if (product.status !== 'Delivered') {
        return res.status(400).json({ message: 'Only delivered products can be returned' });
      }
  
      product.status = 'Return Requested';
      product.returnReason = returnReason;
  
      // Removed the quantity update code here
      
      await order.save();
  
      res.status(200).json({ message: 'Return request submitted successfully' });
    } catch (error) {
      console.error(error.message);
      res.status(500).json({ message: 'Server Error' });
    }
  };
  

  const orderSuccess = async (req, res) => {
    try {
        const order = await Order.findById(req.params.orderId).populate({
            path: 'products.productId',
            populate: { path: 'variants' }
        });

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Calculate subtotal
        let subtotal = order.products.reduce((sum, item) => sum + (item.price * item.quantity), 0);

        // Calculate the discount amount
        let discountAmount = 0;
        if (order.coupon && order.coupon.discount) {
            discountAmount = (subtotal * order.coupon.discount) / 100;
            // Apply max discount if applicable
            if (order.coupon.maxAmount && discountAmount > order.coupon.maxAmount) {
                discountAmount = order.coupon.maxAmount;
            }
        }

        res.render('orderSummary', { order, subtotal, discountAmount });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};


// In your controller file
const retryPayment = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const amountInPaise = Math.round(amount * 100);
        const razorpayOrder = await razorpay.orders.create({
            amount: amountInPaise,
            currency: 'INR',
            receipt: order.orderId,
            payment_capture: 1
        });

        order.razorpayOrderId = razorpayOrder.id;
        await order.save();

        res.json({
            success: true,
            razorpayOrderId: razorpayOrder.id,
            amount: amountInPaise,
            currency: 'INR',
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error retrying payment:', error);
        res.status(500).json({ success: false, message: 'Failed to retry payment.', error: error.message });
    }
};

module.exports = {
    placeOrder,
    loadOrders,
    cancelOrder,
    returnOrder,
    orderSuccess,
    updatePaymentStatus,
    retryPayment 
    

};

