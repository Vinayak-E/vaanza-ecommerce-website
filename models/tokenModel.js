const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const tokenSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires:60

        
    }
})

// tokenSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 });
module.exports = mongoose.model('Token',tokenSchema);