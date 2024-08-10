const User = require("../models/userModel");
const Category = require("../models/categoriesModel");
const Product = require("../models/productSchema");
const Cart = require("../models/cartSchema");
const Address = require("../models/addressSchema")
const Offer = require("../models/offerModel");
const Coupon = require("../models/couponModel");




const getBestOffer = (product, offers) => {
  if (!offers || offers.length === 0) {
    return null;
  }

  const relevantOffers = offers.filter(offer => 
    (offer.type === 'category' && offer.category.some(c => c.category.toString() === product.category._id.toString())) ||
    (offer.type === 'product' && offer.products.some(p => p.productId.toString() === product._id.toString())) 
  );

  const activeOffers = relevantOffers.filter(offer => offer.status);

  const bestOffer = activeOffers.reduce((maxOffer, offer) => offer.discount > maxOffer.discount ? offer : maxOffer, { discount: 0 });

  return bestOffer.discount > 0 ? bestOffer : null;
};


const loadCart = async (req, res) => {
  try {
    if (!req.session.user || !req.session.user._id) {
      req.flash("error", "Please login to get our service");
      return res.redirect("/login");
    }

    const userId = req.session.user._id;
    const cart = await Cart.findOne({ userId }).populate({
      path: "products.productId",
      populate: { path: "variants" }
    });

    // Fetch all offers
    const allOffers = await Offer.find({ status: true });

    // Calculate best offer for each product
    cart.products.forEach(cartItem => {
      const product = cartItem.productId;
      const bestOffer = getBestOffer(product, allOffers);
      cartItem.bestOffer = bestOffer;
      cartItem.finalPrice = bestOffer ? product.price * (1 - bestOffer.discount / 100) : product.price;
    });


    res.render("cart", { cart });
  } catch (err) {
    console.log(err.message);
    res.status(500).send("An error occurred");
  }
};


  const addToCart = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            return res.json({
              login: true,
              message: "Please login and continue shopping!",
            });
        }
       // Assuming you have a logged in user and`req.session.userId` 
         const userId = req.session.user && req.session.user._id;
        const { productId, variantId, size, quantity } = req.body;
        console.log("size",req.body.size)
      // Fetch the product and variant details from the database
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
  
      const variant = product.variants.find(v => v._id.toString() === variantId);
      if (!variant) {
        return res.status(404).json({ error: 'Variant not found' });
      }
  
     
     // Define the maximum quantity limit
     const MAX_QUANTITY = 5;

     // Use Math.min to ensure the quantity does not exceed the limit
     const requestedQuantity = Math.min(parseInt(quantity), MAX_QUANTITY);


      // Construct the cart item object
      const cartItem = {
        productId: product._id,
        variantId: variant._id, 
        quantity: requestedQuantity,
        size
      };
  
      // Find the user's cart or create a new one if it doesn't exist
      let cart = await Cart.findOne({ userId });
  
      if (!cart) {
        cart = new Cart({ userId, products: [] });
      }
  
      // Check if the product with the same variant and size already exists in the cart
      const existingItem = cart.products.find(item =>
        item.productId.equals(cartItem.productId) &&
        item.variantId.equals(cartItem.variantId) 
        
      );
  
      if (existingItem) {
        // If the item already exists, increase its quantity
        existingItem.quantity = Math.min(existingItem.quantity + requestedQuantity, MAX_QUANTITY);
      } else {
        // Otherwise, add the new item to the cart
        cart.products.push(cartItem);
      }
  
      // Save the updated cart
      await cart.save();
  
      res.status(200).json({ message: 'Product added to cart successfully' });
    } catch (error) {
      console.error('Error adding product to cart:', error);
      res.status(500).json({ error: 'Failed to add product to cart' });
    }
  };


const quantityUpdationCart = async (req, res) => {
  const { productId, variantId, size, quantity } = req.body;
    
 
  try {
      const userId = req.session.user._id;
      const cart = await Cart.findOne({ userId });

      if (!cart) {
          return res.status(404).json({ message: 'Cart not found' });
      }

      const productIndex = cart.products.findIndex(p => p.productId.toString() === productId);

      if (productIndex > -1) {
          // Update the quantity
          cart.products[productIndex].quantity = quantity;

          const product = await Product.findById(productId); // Fetch the product details

          if (!product) {
              return res.status(404).json({ message: 'Product not found' });
          }

          // Recalculate discounts
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

          // Save the cart
          await cart.save();

          const subTotal = finalPrice * quantity;

          return res.json({
              success: true,
              productId,
              finalPrice,
              quantity,
              subTotal
          });
      } else {
          return res.status(404).json({ message: 'Product not found in cart' });
      }
  } catch (err) {
      console.error('Error occurred:', err);
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};



const removeCartItem = async (req, res) => {
    const { productId, variantId } = req.body;

    if (!req.session.user || !req.session.user._id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const userId = req.session.user._id;
        const result = await Cart.findOneAndUpdate(
            { userId },
            {
                $pull: {
                    products: {
                        productId: productId,
                        variantId: variantId
                    },
                },
            },
            { new: true }
        );

        if (!result) {
            return res.status(404).json({ success: false, message: 'Cart or product not found' });
        }

        res.json({ success: true, message: 'Product removed from cart successfully', cart: result });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Internal Server Error' });
    }
};


const checkout = async (req, res) => {
  try {
      if (!req.session.user || !req.session.user._id) {
          return res.status(401).json({ success: false, message: 'Unauthorized' });
      }

      const userId = req.session.user._id;

      // Fetch user and cart details
      const user = await User.findOne({ _id: userId });
      const addresses = await Address.find({ user: userId });
      const coupons = await Coupon.find({});
      const cart = await Cart.findOne({ userId }).populate({
          path: 'products.productId',
          populate: {
              path: 'category'
          }
      });

      // Check if cart and products are present
      if (!cart || !cart.products) {
          return res.render('checkout', { user, addresses, cart: { products: [] }, totalPrice: 0, shippingCharge: 0 });
      }

      // Calculate total price and shipping charge
      let subtotal = 0;
      let totalDiscount = 0;

      for (let cartItem of cart.products) {
          const product = cartItem.productId;
          
          // Calculate the best offer for the product
          const offers = await Offer.find({
              $or: [
                  { 'products.productId': product._id },
                  { 'category.category': product.category._id }
              ],
              status: true
          });

          const bestOffer = offers.reduce((best, offer) => 
              offer.discount > best.discount ? offer : best, { discount: 0 }
          );

          const originalPrice = product.price * cartItem.quantity;
          const discountAmount = originalPrice * (bestOffer.discount / 100);
          const finalPrice = originalPrice - discountAmount;
    
          cartItem.finalPrice = finalPrice / cartItem.quantity; // Store per-item final price
          cartItem.discount = discountAmount; // Store discount amount for this item
    
          subtotal += finalPrice;
          totalDiscount += discountAmount;
      }

      // Determine shipping charge based on subtotal
      const shippingCharge = subtotal > 500 ? 0: 50;
      const totalPrice = subtotal + shippingCharge;

      res.render('checkout', { user, addresses, cart, totalPrice, shippingCharge,coupons, totalDiscount: totalDiscount.toFixed(2) });
  } catch (error) {
      console.error('Error fetching addresses:', error);
      res.status(500).send('An error occurred');
  }
};



  
  module.exports = {
    loadCart,
    addToCart,
    quantityUpdationCart,
    removeCartItem,
    checkout
    
  };
  







  