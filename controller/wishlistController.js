const User = require("../models/userModel");
const Wishlist = require("../models/wishlistModel");

const Category = require("../models/categoriesModel");
const Product = require("../models/productSchema");
const Offer = require("../models/offerModel");
const Cart =require("../models/cartSchema")

const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        // Retrieve the user's wishlist and populate products
        let wishlist = await Wishlist.findOne({ user: userId }).populate({
            path: "products.product",
            populate: { path: "variants" }
        });

        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                products: []
            });
            await wishlist.save();
        }

        let cartCount = 0;
        let subtotal = 0;
        let cartProductIds = [];

        const cart = await Cart.findOne({ userId: userId }).populate('products.productId');

        if (cart) {
            cartCount = cart.products.reduce((acc, product) => acc + product.quantity, 0);
            subtotal = cart.products.reduce((sum, item) => sum + (item.productId.finalPrice * item.quantity), 0);
            cartProductIds = cart.products.map(item => item.productId._id.toString());
        }

        // Filter wishlist products that are not in the cart
        wishlist.products = wishlist.products.filter(item =>
            !cartProductIds.includes(item.product._id.toString())
        );

        await wishlist.save();

        // Filter products based on is_Listed and populate category and variants
        const products = await Promise.all(wishlist.products.map(async (item) => {
            const product = await Product.findOne({ 
                _id: item.product._id, 
                is_Listed: true 
            })
            .populate({
                path: 'category',
                match: { is_Listed: true }
            })
            .populate('variants');

            if (product) {
                // Only include the specific variant that was added to the wishlist
                product.variants = product.variants.filter(variant => 
                    variant._id.toString() === item.variant.toString()
                );
            }

            return product;
        }));

        // Remove any null products (in case a product became unlisted)
        const filteredProducts = products.filter(Boolean);

        res.render('wishlist', {
            user,
            userId,
            cart,
            subtotal,
            products: filteredProducts,
            cartCount
        });

    } catch (err) {
        console.error('Error fetching wishlist', err);
        res.status(500).send('Internal server error');
    }
};



const addToWishlist = async (req, res) => {
    try {
        if (!req.session.user || !req.session.user._id) {
            req.flash('error', 'Please login to add items to your wishlist.');
            console.log('Flash message set:', req.flash('error'));
            return res.redirect('/login');  // Redirect to the login page
        }

        const user = req.session.user;
        const { productId, variantId } = req.body;

        const cart = await Cart.findOne({ userId: user._id });
        if (cart) {
            const isInCart = cart.products.some(item => item.productId.toString() === productId && item.variantId.toString() === variantId);
            if (isInCart) {
                return res.json({ success: false, inCart: true, message: 'Product is already in the cart!' });
            }
        }

        let wishlist = await Wishlist.findOne({ user: user._id });
        if (!wishlist) {
            wishlist = new Wishlist({
                user: user._id,
                products: []
            });
        }

        const existingProduct = wishlist.products.find(item => item.product.toString() === productId && item.variant.toString() === variantId);
        if (existingProduct) {
            return res.json({ success: false, existing: true, message: 'Product already added!' });
        }

        wishlist.products.push({ product: productId, variant: variantId });
        await wishlist.save();

        return res.status(200).json({ success: true, message: 'Product added to wishlist!' });
    } catch (err) {
        console.error('Error adding to wishlist:', err);
        return res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
    }
};





const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { productId, variantId } = req.body; // Use body instead of params

        const wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        // Find the product and variant to remove
        wishlist.products = wishlist.products.filter(item => 
            !(item.product.toString() === productId && item.variant.toString() === variantId)
        );

        await wishlist.save();

        res.json({ success: true, message: 'Variant removed from wishlist' });
    } catch (err) {
        console.error('Error removing variant from wishlist:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


module.exports = {

    loadWishlist,
    addToWishlist,
    removeFromWishlist

}