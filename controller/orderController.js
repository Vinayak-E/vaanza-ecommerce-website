const User = require("../models/userModel");
const Order = require("../models/orderModel");
const Cart = require("../models/cartSchema");
const Address = require("../models/addressSchema")
const Product = require("../models/productSchema");
const crypto = require('crypto');



const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId , paymentMethod} = req.body;

        // Fetch the user's cart with populated product details
        const cart = await Cart.findOne({ userId }).populate('products.productId');
        if (!cart) {
            return res.status(400).json({ success: false, message: 'Cart not found.' });
        }

        // Filter out products with quantity > 0
        const filteredProducts = cart.products.filter(item => item.quantity > 0);

        // Initialize totals and shipping charge
        let subtotal = 0;
        const shippingCharge = 50; // Fixed shipping charge
        let totalAmount = 0;

        // Map filtered products to the order products format
        const products = filteredProducts.map(item => {
            const product = item.productId;
            const variant = item.variantId;
            const itemTotal = product.price * item.quantity;
            subtotal += itemTotal; // Calculate subtotal
            const status =  "Pending"

            return {
                productId: product._id,
                variantId: variant._id,
                quantity: item.quantity,
                size: item.size, // Assuming size is available in cart item
                price: product.price,
                status
            };
        });

        // Determine the shipping charge
        const finalShippingCharge = subtotal > 500 ? shippingCharge : 0;

        // Calculate total amount
        totalAmount = subtotal + finalShippingCharge;

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
        const orderId = generateRandomId(10);
        // Create a new order
        const newOrder = new Order({
            orderId,
            userId,
            addressId,
            products,
            totalAmount,
            orderDate: new Date(),
            paymentMethod: paymentMethod,
            shippingCharge:finalShippingCharge
        });

        // Save the order
        await newOrder.save();

        // Clear the user's cart
        await Cart.findOneAndUpdate({ userId }, { $set: { products: [] } });

        return res.json({ success: true , orderId: newOrder._id });
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
  
      const product = order.products.find(p => p._id.toString() === productId && p.variantId === variantId);
      if (!product) {
        return res.status(404).json({ message: 'Product not found in the order' });
      }
  
      if (product.status !== 'Delivered') {
        return res.status(400).json({ message: 'Only delivered products can be returned' });
      }
  
      product.status = 'Returned';
      product.returnReason = returnReason;
  
      const originalProduct = await Product.findById(productId);
      const variant = originalProduct.variants.id(variantId);
      if (!variant) {
        return res.status(404).json({ message: 'Variant not found in the product' });
      }
  
      variant.quantity += product.quantity;
      await originalProduct.save();
      await order.save();
  
      res.status(200).json({ message: 'Product returned and restocked successfully' });
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
          .populate('addressId')  

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

