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
    addresses:[
       {
        name:{
            type:String
        },addressline:{
            type:String
        },
        city:{
            type:String
        },
        state:{
            type:String
        },pincode:{
            type:Number
        },
        phone:{
            type:Number
        }

       }
    ],
    createdAt: {
        type: Date,
        default: Date.now
    }, 
      wallet:{
        type:Number,
        default:0
    },
    walletHistory:[{
        date:{
            type:Date
        },
        amount:{
            type:Number,
        },
        reason:{
            type: String,
        }
    }]

})

module.exports = mongoose.model('User',userSchema)