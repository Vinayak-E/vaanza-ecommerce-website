const mongoose = require('mongoose');



const categoriesSchema = mongoose.Schema({

    name:{
        type:String,
        required:true

    },
    description:String,
    is_listed:{
        type:Boolean
    }
})

module.exports = mongoose.model('categories',categoriesSchema);