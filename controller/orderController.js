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

key_id = "rzp_test_vVHTvfU31Svako"
key_secret = "Qv0v56Dn7c3pdmtfhc0LKmjS"



const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { addressId, paymentMethod,  couponCode, razorpay_payment_id, razorpay_order_id, razorpay_signature, } = req.body;
  
    // Fetch address
    const address = await Address.findById(addressId);
    if (!address) {
      return res.status(400).json({ success: false, message: 'Address not found.' });
    }

    // Fetch the user's cart with populated product details
    const cart = await Cart.findOne({ userId }).populate({
      path: 'products.productId',
      populate: {
        path: 'category'
      }
    });
    if (!cart) {
      return res.status(400).json({ success: false, message: 'Cart not found.' });
    }

    // Filter out products with quantity > 0
    const filteredProducts = cart.products.filter(item => item.quantity > 0);

    // Initialize totals and shipping charge
    let shippingCharge = 50;
    let subtotal = 0;



    // Map filtered products to the order products format
    const products = await Promise.all(filteredProducts.map(async item => {
      const product = item.productId;
      const variant = item.variantId;

      // Fetch offers for the product
      const offers = await Offer.find({
        $or: [
          { 'products.productId': product._id },
          { 'category.category': product.category }
        ],
        status: true
      });

      // Determine the best offer
      const bestOffer = offers.reduce((best, offer) =>
        offer.discount > best.discount ? offer : best, { discount: 0 }
      );

      // Calculate the final price after applying the offer
      const finalPrice = product.price * (1 - bestOffer.discount / 100);
      const itemTotal = finalPrice * item.quantity;

      subtotal += itemTotal; // Calculate subtotal
      const status = "Pending";

      return {
        productId: product._id,
        variantId: variant._id,
        quantity: item.quantity,
        size: item.size, // Assuming size is available in cart item
        price: finalPrice,
        status
      };
    }));

   
let couponDiscount = 0;
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
      couponDiscount = subtotal * coupon.discount / 100;
      if (coupon.maxAmount && couponDiscount > coupon.maxAmount) {
        couponDiscount = coupon.maxAmount;
      }
  }
}
 // Fixed shipping charge
        // Calculate total amount
        const finalShippingCharge = subtotal > 500 ? 0 : shippingCharge;
        console.log("subtotal", subtotal);
        console.log("finalShippingCharge", finalShippingCharge);
        const totalAmount = subtotal - couponDiscount + finalShippingCharge;
        console.log("totalAmount", totalAmount);
    // Ensure totalAmount is a number and not NaN
    if (isNaN(totalAmount) || totalAmount < 0) {
      throw new Error(`Total amount calculation failed. Subtotal: ${subtotal}, Coupon Discount: ${couponDiscount}, Shipping Charge: ${shippingCharge}, Total Amount: ${totalAmount}`);
    }

    // Reduce the variant stock for each ordered product
    for (let i = 0; i < products.length; i++) {
      const orderedProduct = products[i];
      const product = await Product.findById(orderedProduct.productId);
      if (product) {
        // Find the variant that matches the ordered size
        const variant = product.variants.find(v => v.sizes.includes(orderedProduct.size));
        if (variant) {
          variant.quantity -= orderedProduct.quantity; // Reduce the variant quantity
          await product.save(); // Save the updated product
        }
      }
    }

    function generateRandomId(length) {
      const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      let result = '';
      const randomValues = new Uint8Array(length);
      crypto.randomFillSync(randomValues); // Use Node.js crypto library

      for (let i = 0; i < length; i++) {
        result += charset[randomValues[i] % charset.length];
      }
      return result;
    }

    // Generate order ID
    const orderId = generateRandomId(10); // Implement this function as before

    if (paymentMethod === 'Razor pay') {
      // Initialize Razorpay
      const razorpay = new Razorpay({
        key_id: 'rzp_test_vVHTvfU31Svako',
        key_secret: 'Qv0v56Dn7c3pdmtfhc0LKmjS'
      });

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
        // Create a Razorpay order
        const amountInPaise = Math.round(totalAmount * 100);
        console.log("Amount in Paise for Razorpay:", amountInPaise);
        const razorpayOrder = await razorpay.orders.create({
          amount: amountInPaise, // Razorpay expects amount in paise
          currency: 'INR',
          receipt: orderId,
          payment_capture: 1 // Auto-capture payment
        });

        // Return Razorpay order details to client
        return res.json({
          success: true,
          razorpayOrderId: razorpayOrder.id,
          amount: amountInPaise,
          currency: 'INR',
          keyId: 'rzp_test_vVHTvfU31Svako'
        });
      } else {
        // Verify the payment signature
        const generated_signature = crypto
          .createHmac('sha256', 'Qv0v56Dn7c3pdmtfhc0LKmjS')
          .update(razorpay_order_id + "|" + razorpay_payment_id)
          .digest('hex');

        if (generated_signature !== razorpay_signature) {
          return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }
      }
    }

    // Create a new order
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
      paymentStatus: paymentMethod === 'Razor pay' ? 'Paid' : 'Pending',
      shippingCharge: finalShippingCharge  
    });

    // Save the order
    await newOrder.save();

    // Clear the user's cart
    await Cart.findOneAndUpdate({ userId }, { $set: { products: [] } });

    return res.json({ success: true, orderId: newOrder._id });

  } catch (error) {
    console.error('Error placing order:', error);
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

const cancelOrder = async (req, res) => {
    try {
      const { orderId, productId, variantId, cancelReason } = req.body;
       
      const user = req.session.user
  
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


      
      const productPurchasePrice = product.price;

      let wallet  = await Wallet.findOne({ user: user._id });

      if (!wallet) {
          const newWallet = new Wallet({
              user: user._id,
              balance: 0,
              transactions: []
          });

          await newWallet.save();

          wallet = await Wallet.findOne({ user: user._id });
      }

      wallet.balance += productPurchasePrice;

      await wallet.save();
  
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
          })
         

        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        res.render('orderSummary', { order });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ message: 'Server Error' });
    }
};



module.exports = {
    placeOrder,
    loadOrders,
    cancelOrder,
    returnOrder,
    orderSuccess
    

};

