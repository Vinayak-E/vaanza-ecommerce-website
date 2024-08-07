const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  
    offerName:{
        type:String,
        required:true
    },
    description: {
        type: String,
        required: true
    },
    discount: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        required:true
    },
    products:[ {  
         productId: { type: mongoose.Types.ObjectId, ref: 'Product', required: true }}
    ],
    category:[{
        category: {
            type: mongoose.Types.ObjectId,
            required: true,
            ref: "categories",
          },

    }],
    status:{
        type:Boolean
    }
});
module.exports = mongoose.model("Offer", offerSchema);