const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  customerInfo: {
    name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },
    address: { type: String, required: true },
    pincode: { type: String, required: true },
    city: { type: String, required: true }
  },
  products: [
    {
      productId: { type: mongoose.Schema.Types.Mixed, required: true },
      name: { type: String, required: true },
      price: { type: Number, required: true },
      quantity: { type: Number, required: true },
      image: { type: String }
    }
  ],
  totalAmount: { type: Number, required: true },
  paymentScreenshot: { type: String },
  orderDate: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' }
});

module.exports = mongoose.model('Order', OrderSchema);