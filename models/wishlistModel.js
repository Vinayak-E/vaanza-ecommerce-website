const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema({
    products: [
        {
          product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
          variant: { type: mongoose.Schema.Types.ObjectId, ref: 'Product.variants' }
        }
      ],
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }
});

const Wishlist = mongoose.model('wishlist', wishlistSchema);

module.exports = Wishlist;