const User = require("../models/userModel");
const Wishlist = require("../models/wishlistModel");

const Category = require("../models/categoriesModel");
const Product = require("../models/productSchema");
const Offer = require("../models/offerModel");
const Cart =require("../models/cartSchema")




const loadWishlist = async (req, res) => {
    try {
        
        const userId = req.session.user._id;

        console.log("user",userId)
        const user = await User.findById(userId);

        // Retrieve the user's wishlist and populate products
        let wishlist = await Wishlist.findOne({ user: userId }).populate('products.product');

        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                products: []
            });
            await wishlist.save();
        }

        const cart = await Cart.findOne({ userId: userId }).populate('products.productId');
        let subtotal = 0;

        if (cart) {
            subtotal = cart.products.reduce((sum, item) => sum + (item.productId.finalPrice * item.quantity), 0);
        }

        const cartProductIds = cart ? cart.products.map(item => item.productId._id.toString()) : [];

        wishlist.products = wishlist.products.filter(item => 
            !cartProductIds.includes(item.product._id.toString())
        );

        await wishlist.save();

        const wishlistProductIds = wishlist.products.map(item => item.product._id);

        const products = await Product.find({ _id: { $in: wishlistProductIds }, is_Listed: true })
            .populate({
                path: 'category',
                match: { is_Listed: true }
            }).populate('variants');
           

        res.render('wishlist', {
            user,
            userId,
            cart,
            subtotal,
            products
        });

    } catch (err) {
        console.error('Error fetching wishlist', err);
        res.status(500).send('Internal server error');
    }
};



const addToWishlist = async (req, res) => {
    try {
        const user = req.session.user;
        const productId = req.params.product_id;

        const cart = await Cart.findOne({ userId: user._id });
        if (cart) {
            const isInCart = cart.products.some(item => item.productId.toString() === productId);
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

        const existingProduct = wishlist.products.find(item => item.product.toString() === productId);
        if (existingProduct) {
            return res.json({ success: false, existing: true, message: 'Product already added!' });
        }

        wishlist.products.push({ product: productId });
        await wishlist.save();

        res.status(200).json({ success: true, message: 'Product added to wishlist!' });
    } catch (err) {
        console.error('Error adding to wishlist: ', err);
        res.status(500).send('Internal server error');
    }
};





const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.params.product_id;

        const wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(item => item.product.toString() !== productId);

        await wishlist.save();

        res.json({ success: true, message: 'Product removed from wishlist' });
    } catch (err) {
        console.error('Error removing product from wishlist:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


module.exports = {

    loadWishlist,
    addToWishlist,
    removeFromWishlist

}