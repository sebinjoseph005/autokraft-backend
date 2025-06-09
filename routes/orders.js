const express = require('express');
const router = express.Router();
const multer = require('multer');
const Order = require('../models/Order');
const path = require('path');
const fs = require('fs');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/payments/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// Create new order with payment screenshot
router.post('/', upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const { name, email, phone, address, pincode, city, totalAmount, products } = req.body;

    // Basic validation
    if (!products || JSON.parse(products).length === 0) {
      return res.status(400).json({ error: 'Cart cannot be empty' });
    }

    if (!email || !address || !req.file) {
      return res.status(400).json({ error: 'Required fields missing' });
    }

    const order = new Order({
      customerInfo: { name, email, phone, address, pincode, city },
      products: JSON.parse(products),
      totalAmount,
      paymentScreenshot: req.file.path,
      status: 'pending'
    });

    await order.save();
    res.status(201).json(order);
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ 
      error: 'Order processing failed',
      details: error.message 
    });
  }
});

// Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch orders',
      details: error.message 
    });
  }
});

module.exports = router;