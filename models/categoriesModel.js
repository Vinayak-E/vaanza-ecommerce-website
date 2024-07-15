const mongoose = require('mongoose');
const categoriesSchema = mongoose.Schema({

    name:{
        type:String,
        required:true

    },
    description:String,
    is_listed:{
        type:Boolean
    },
    gender: {
        type: String,
        required: true,
        enum: ["Men", "Women"] // Assuming gender is either Male or Female
      }
})

module.exports = mongoose.model('categories',categoriesSchema);