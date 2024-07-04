const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const variantSchema = new Schema({
  color: { 
    type: String,
     required: true 
    },
  size: { 
    type: String,
     required: true
     },
  quantity: {
     type: Number,
      required: true 
    },
  images: [String] 
});

const productSchema = mongoose.Schema({

  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  sizes: {
    type: Array,
  },
  category: {
    type: String,
    required: true,
  },
  categorys: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "categories",
  },
  images: {
    type: Array,
  },
  variants: [variantSchema], 
  stockQuantity: {
    type: Number,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  is_Listed: {
    type: Boolean,
    required: true,
  }
});
module.exports = mongoose.model("Product", productSchema);




