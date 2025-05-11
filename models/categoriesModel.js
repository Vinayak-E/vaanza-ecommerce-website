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
        enum: ["Men", "Women"] 
      }
})

module.exports = mongoose.model('categories',categoriesSchema);