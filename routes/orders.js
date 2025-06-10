const express = require('express');
const router = express.Router();
const multer = require('multer');
const Order = require('../models/Order');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

// Enable CORS for all routes (adjust origin as needed)
router.use(cors({
  origin: 'https://autokraft.vercel.app', // Your frontend URL
  methods: ['GET', 'POST'],
  credentials: true,
}));

// Force HTTPS middleware (for proxies like Vercel)
router.use((req, res, next) => {
  if (req.headers['x-forwarded-proto'] !== 'https' && process.env.NODE_ENV === 'production') {
    return res.redirect(`https://${req.headers.host}${req.url}`);
  }
  next();
});

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/payments/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
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

// Create new order
router.post('/', upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const { name, email, phone, address, pincode, city, totalAmount, products } = req.body;

    if (!products) {
      return res.status(400).json({ error: 'Products data is required' });
    }

    const parsedProducts = JSON.parse(products);

    if (!Array.isArray(parsedProducts) || parsedProducts.length === 0) {
      return res.status(400).json({ error: 'Cart cannot be empty' });
    }

    if (!email || !address || !req.file) {
      return res.status(400).json({ error: 'Required fields missing or payment screenshot not uploaded' });
    }

    const order = new Order({
      customerInfo: { name, email, phone, address, pincode, city },
      products: parsedProducts,
      totalAmount,
      paymentScreenshot: req.file.path,
      status: 'pending'
    });

    await order.save();
    res.status(201).json({ success: true, order });
  } catch (error) {
    console.error('Order creation error:', error);
    res.status(400).json({ error: 'Order processing failed', details: error.message });
  }
});

// Get all orders
router.get('/', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json(orders);
  } catch (error) {
    console.error('Order fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
  }
});

module.exports = router;