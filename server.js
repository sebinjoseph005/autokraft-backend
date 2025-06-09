require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Create uploads folder if not exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true }); // recursive: true for nested directories
}

// Enhanced Multer setup with file filtering
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid file type. Only JPEG, JPG, and PNG are allowed!'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Enhanced DB connection with retry logic
const connectDB = async () => {
  const maxRetries = 3;
  let retries = 0;
  
  while (retries < maxRetries) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        retryWrites: true,
        w: 'majority'
      });
      console.log('✅ MongoDB connected successfully');
      return;
    } catch (err) {
      retries++;
      console.error(`❌ MongoDB connection attempt ${retries} failed:`, err.message);
      if (retries < maxRetries) {
        await new Promise(res => setTimeout(res, 5000)); // wait 5 seconds
      } else {
        console.error('❌ Failed to connect to MongoDB after maximum retries.');
        throw err;
      }
    }
  }
};

// Enhanced CORS configuration
const corsOptions = {
  origin: [
    'http://localhost:3000', 
    process.env.FRONTEND_URL,
    'https://your-production-frontend.vercel.app'
  ].filter(Boolean), // Remove any falsy values
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight for all routes

// Security middleware
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use('/uploads', express.static(uploadDir)); // Serve uploaded files

// Order Schema and Model (improved with validation)
const orderSchema = new mongoose.Schema({
  customerInfo: {
    name: { type: String, required: [true, 'Name is required'] },
    email: { 
      type: String, 
      required: [true, 'Email is required'],
      match: [/.+\@.+\..+/, 'Please enter a valid email']
    },
    phone: { 
      type: String, 
      required: [true, 'Phone is required'],
      validate: {
        validator: function(v) {
          return /^\d{10}$/.test(v); // Exact 10-digit check
        },
        message: props => `${props.value} is not a valid phone number!`
      }
    },
    address: { type: String, required: [true, 'Address is required'] },
    pincode: { type: String, required: [true, 'Pincode is required'] },
    city: { type: String, required: [true, 'City is required'] },
  },
  products: [{
    productId: { type: String, required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: [0, 'Price must be positive'] },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'] },
    image: { type: String },
  }],
  totalAmount: { type: Number, required: true, min: [0, 'Total must be positive'] },
  paymentScreenshot: { type: String },
  orderDate: { type: Date, default: Date.now },
  status: { type: String, default: 'pending', enum: ['pending', 'processing', 'shipped', 'delivered'] },
}, { timestamps: true });

const Order = mongoose.model('Order', orderSchema);

// Enhanced order submission route
app.post('/api/orders', upload.single('paymentScreenshot'), async (req, res) => {
  try {
    const { body, file } = req;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'Payment screenshot is required',
      });
    }

    const requiredFields = ['name', 'email', 'phone', 'address', 'pincode', 'city', 'totalAmount', 'products'];
    const missingFields = requiredFields.filter(field => !body[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
      });
    }

    let parsedProducts;
    try {
      parsedProducts = JSON.parse(body.products);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid products format',
      });
    }

    const newOrder = new Order({
      customerInfo: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        pincode: body.pincode,
        city: body.city,
      },
      totalAmount: Number(body.totalAmount),
      products: parsedProducts,
      paymentScreenshot: `/uploads/${file.filename}`,
    });

    await newOrder.save();

    res.status(201).json({
      success: true,
      order: newOrder,
    });

  } catch (error) {
    console.error('❌ Order creation error:', error);

    if (req.file) {
      fs.unlink(req.file.path, err => {
        if (err) console.error('Error deleting uploaded file:', err);
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Get all orders (protected in production)
app.get('/api/orders', async (req, res) => {
  try {
    const orders = await Order.find().sort({ orderDate: -1 });
    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch orders' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    dbStatus: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('❗ Server error:', err.stack);

  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message || 'File upload error',
    });
  }

  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🔗 http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Server startup error:', err.message);
    process.exit(1);
  }
};

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  mongoose.connection.close(false, () => {
    console.log('MongoDB connection closed');
    process.exit(0);
  });
});

startServer();
