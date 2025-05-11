const mongoose = require('mongoose');

const userOtpVerificationSchema = mongoose.Schema({
    email: {
        type: String,
    },
    otp: {
        type: String,
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: 60
      }
     

});


const UserOtpVerification = mongoose.model('userOtpVerification', userOtpVerificationSchema);

module.exports = UserOtpVerification;