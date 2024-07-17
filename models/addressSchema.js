const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  name: String,
  number: Number,
  address: String,
  street: String,
  postalCode: String,
  state: String,
  landmark: String,
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const Address = mongoose.model('Address', addressSchema);

module.exports = Address;