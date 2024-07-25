// models/orderModel.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const orderSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    orderId:{
        type:String,
        required:true
    },

  paymentMethod:{
        type:String,
        required:true
    },
    shippingCharge:{
        type:Number,
        required:true
    },

    addressId: { type: Schema.Types.ObjectId, ref: 'Address', required: true },
    products: [{ 
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        variantId: { type: Schema.Types.ObjectId, required: true }, 
        quantity: { type: Number, required: true },
        size: { type: String, required: true },
        price: { type: Number, required: true },
        status:{type:String},
        cancelReason:{type:String}
    }],
    totalAmount: { type: Number, required: true },
    orderDate: { type: Date, required: true }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
