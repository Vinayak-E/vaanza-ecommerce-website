const Coupon = require("../models/couponModel");
const User = require("../models/userModel");
const Order = require("../models/orderModel");
const Cart = require("../models/cartSchema");
const Address = require("../models/addressSchema")
const Product = require("../models/productSchema");
const Offer = require("../models/offerModel");

const loadCoupons  = async (req, res) => {
    try {
        const coupons = await Coupon.find({});
        res.render('coupons', { coupons });
    } catch (error) {
        console.error('Error fetching offers and coupons', error);
        res.status(500).send('Internal server error');
    }
}

const addCoupon = async (req, res) => {
    try {
      const { couponId, discount, description, expiryDate, minPurchaseAmount, maxAmount,status } = req.body;
  console.log(req.body)
      // Check for existing coupon with the same ID
      const existingCoupon = await Coupon.findOne({ couponId });
      if (existingCoupon) {
        return res.status(400).json({ success: false, message: 'Coupon ID already exists.' });
      }
  
      const newCoupon = new Coupon({
        couponId,
        discount,
        description,
        expiryDate,
        minPurchaseAmount,
        maxAmount,
        isActive: status
      });
  
      await newCoupon.save();
  
      res.status(201).json({ success: true, message: 'Coupon added successfully', coupon: newCoupon });
    } catch (error) {
      console.error('Error adding coupon:', error);
      res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
  };



const editCoupon =async (req, res) => {
    try {
      const { editCouponIdHidden,couponId, discount, minPurchaseAmount, expiryDate, description, status, maxAmount} = req.body;
  
   console.log(req.body.editCouponIdHidden)
  
      const isActive = status === 'true';
  
      // Update coupon in the database
      const updatedCoupon = await Coupon.findByIdAndUpdate(
        editCouponIdHidden,
        { discount, minPurchaseAmount, expiryDate, description, isActive,couponId, maxAmount },
        { new: true }
      );
  
      if (!updatedCoupon) {
        return res.status(404).json({ success: false, message: 'Coupon not found' });
      }
  
      res.json({ success: true, coupon: updatedCoupon });
    } catch (err) {
      console.error('Error updating coupon:', err);
      res.status(500).json({ success: false, message: 'Failed to update coupon' });
    }
  };



  const deleteCoupon = async (req, res) => {
    try {
      const { couponId } = req.params;
      console.log(req.params)
      
      await Coupon.findByIdAndDelete(couponId);
      
      res.status(200).json({ message: 'Coupon deleted successfully' });
    } catch (error) {
      console.error('Error deleting Coupon:', error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  };
  

  const applyCoupon = async (req, res) => {
    try {
        const code = req.params.couponCode;
        const user = req.session.user;

        // Fetch the user's cart with populated product details
        const cart = await Cart.findOne({ userId: user._id }).populate({
            path: 'products.productId',
            populate: {
                path: 'category'
            }
        });

        // Fetch the coupon details
        const coupon = await Coupon.findOne({ couponId: code });
        console.log(coupon,"code")
        // Check if the coupon has already been used by the user
        const usedCoupon = await Order.findOne({
            userId: user._id,
            'products.couponId': code
        });

        if (usedCoupon) {
            return res.status(400).json({ success: false, message: "You have already used this coupon." });
        }

        if (!coupon) {
            return res.status(400).json({ success: false, message: 'The coupon is not valid!' });
        }

        if (!cart || cart.products.length === 0) {
            return res.status(400).json({ success: false, message: 'The cart is empty!' });
        }

        // Initialize subtotal
        let subtotal = 0;
        const shippingCharge = 50; // Fixed shipping charge

        // Map to calculate the final price for each product
        const products = await Promise.all(cart.products.map(async item => {
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

            // Calculate the final price after applying the best offer
            const finalPrice = product.price * (1 - bestOffer.discount / 100);
            const itemTotal = finalPrice * item.quantity;

            subtotal += itemTotal; // Calculate subtotal

            return {
                productId: product._id,
                variantId: variant._id,
                quantity: item.quantity,
                size: item.size, // Assuming size is available in cart item
                price: finalPrice
            };
        }));

        // Check coupon validity
        const currDate = Date.now();
        if (subtotal < coupon.minPurchaseAmount || new Date(coupon.expiryDate) < currDate) {
            return res.status(400).json({ success: false, message: 'The coupon is not valid!' });
        }

        // Calculate coupon discount as a fixed amount
        const couponDiscount = subtotal * coupon.discount / 100;
        const finalShippingCharge = subtotal > 500 ? 0 : shippingCharge;
        const totalAmount = subtotal - couponDiscount + finalShippingCharge;
console.log("tatalAmount",totalAmount)
        // Ensure totalAmount is a number and not NaN
        if (isNaN(totalAmount) || totalAmount < 0) {
            throw new Error('Total amount calculation failed.');
        }

        res.status(200).json({
            success: true,
            subtotal: parseFloat(subtotal.toFixed(2)),
            couponDiscount: parseFloat(couponDiscount.toFixed(2)),
            shipping: parseFloat(finalShippingCharge.toFixed(2)),
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            couponDescription: coupon.description,
            code
        });

    } catch (err) {
        console.error('Error applying the coupon: ', err);
        res.status(500).send('Internal server error');
    }
};




module.exports={
    loadCoupons,
    addCoupon,
    editCoupon,
    deleteCoupon,
    applyCoupon
}