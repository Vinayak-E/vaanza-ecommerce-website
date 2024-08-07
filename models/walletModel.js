const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
  },
  balance: {
    type: Number,
  },
  transactions: [{
      amount: {
          type: Number,
      },
      timestamp: {
          type: Date,
          default: Date.now,
      },
      transactionId: {
          type: String,
      },
      type: {
          type: String,
          enum: ['credit', 'debit'],
      }
  }]
});

const Wallet = mongoose.model('wallets', walletSchema);

module.exports = Wallet;