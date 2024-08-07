const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema({
    couponId: {
        type: String,
        required: true
    },
    discount: {
        type: Number,
        required:true
    },
    description: {
        type: String,
        required:true
    },
    expiryDate: {
        type: String,
        required:true
    },
    minPurchaseAmount: {
        type: Number,
        required:true
    },
    maxAmount:{
        type:Number
    },
    usedUsers:[
        {
            type:String
        }
    ],
    isActive: {
        type: Boolean,
        default:true
    }
}); 

const Coupon = mongoose.model('coupons', couponSchema);

module.exports = Coupon;