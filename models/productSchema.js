const mongoose = require("mongoose");
const Schema = mongoose.Schema;


const variantSchema = new Schema({
  color: { 
    type: String,
    required: true 
  },
  images: [String], // Add this line to include images for each variant
  
  quantity: {
    type: Number,
    required: true 
  },
  sizes: [{ type: String }], // Array of size strings
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
  category: {
    type: mongoose.Types.ObjectId,
    required: true,
    ref: "categories",
  },
  is_Listed: {
    type: Boolean,
    required: true,
  },
  // images: [String], 
  variants: [variantSchema], 
  date: {
    type: Date,
    default: Date.now,
    required: true,
  },
  gender: {
    type: String,
    required: true,
    enum: ["Men", "Women"] // Assuming gender is either Male or Female
  },
  offers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Offer',
  }],
});
module.exports = mongoose.model("Product", productSchema);
