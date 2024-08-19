const mongoose = require('mongoose');

const userSchema = mongoose.Schema({
    name:{
        type:String,
          
    }, 
    
    email:{
        type:String,
        required:true
    },
    mobile:{
        type:String,
        
    },
    
    password:{
        type:String
        
    },
    is_admin:{
        type:Number,
       
       
    },
    verified:{
        type: Boolean
       
    },
    is_blocked: {
        type:Boolean,
        
       
        
    },
    googleId:{
        type:String

    },
   
    createdAt: {
        type: Date,
        default: Date.now
    }, 
    
    addresses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Address' }],

    referralCode: { type: String },
   

})

module.exports = mongoose.model('User',userSchema)