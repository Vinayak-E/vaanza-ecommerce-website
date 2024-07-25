const User = require("../models/userModel");
const Category = require("../models/categoriesModel");
const Product = require("../models/productSchema");
const Cart = require("../models/cartSchema");
const Address = require("../models/addressSchema")


const loadCart = async (req, res) => {
    try {

     if (!req.session.user || !req.session.user._id) {
      req.flash("error", "pleasee login to get our sevice");
      res.redirect("/login");
      
    } else{

        const userId = req.session.user._id;
     
        const cart = await Cart.findOne({  userId }).populate({
            path: "products.productId",
            populate: { path: "variants" }
          });

        res.render("cart",{cart} );

    }
    } catch (err) {
      console.log(err.message);
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
       // Assuming you have a logged in user and`req.session.userId` holds the user's ID
         const userId = req.session.user && req.session.user._id;


        const { productId, variantId, size, quantity } = req.body;
      // Fetch the product and variant details from the database
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(404).json({ error: 'Product not found' });
      }
  
      const variant = product.variants.find(v => v._id.toString() === variantId);
      if (!variant) {
        return res.status(404).json({ error: 'Variant not found' });
      }
  
     
  
      // Construct the cart item object
      const cartItem = {
        productId: product._id,
        variantId: variant._id, 
        quantity: parseInt(quantity),
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
        item.variantId.equals(cartItem.variantId) &&
        item.size === cartItem.size
      );
  
      if (existingItem) {
        // If the item already exists, increase its quantity
        existingItem.quantity += cartItem.quantity;
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

    if (!req.session.user || !req.session.user._id) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    try {
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        const product = cart.products.find(item =>
            item.productId.equals(productId) &&
            item.variantId.equals(variantId) &&
            item.size === size
        );

        if (product) {
            product.quantity = quantity;
            await cart.save();
            return res.json({ success: true });
        } else {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }
    } catch (err) {
        console.error(err);
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
      const cart = await Cart.findOne({ userId }).populate("products.productId") // Ensure product name and price are selected
      
      // Check if cart and products are present
      if (!cart || !cart.products) {
          return res.render('checkout', { user, addresses, cart: { products: [] }, totalPrice: 0, shippingCharge: 0 });
      }

      // Calculate total price and shipping charge
      let subtotal = 0;
      cart.products.forEach(cartItem => {
          const product = cartItem.productId;
          subtotal += product.price * cartItem.quantity;
      });

      // Determine shipping charge based on subtotal
      const shippingCharge = subtotal > 500 ? 50 : 0;
      const totalPrice = subtotal + shippingCharge;

      res.render('checkout', { user, addresses, cart, totalPrice, shippingCharge });
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
  







  