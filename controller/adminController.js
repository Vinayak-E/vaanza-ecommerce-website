const {name} = require('ejs');
const User = require('../models/userModel');
const bcrypt = require('bcrypt'); 
const Address = require("../models/addressSchema")
const Order = require("../models/orderModel");

// Hashing the password

const securePassword = async (password) => {
    try {
        const securePass = await bcrypt.hash(password, 10);
        return securePass;
    } catch (err) {
        console.log(err.message)
    }
} 

// Load the Admin login page

const loadLogin = async (req, res) => {
    try {
        res.render('adminLogin');
    } catch (error) {
        console.log(error.message)
    }
}


// Verifying the login details 

const verifyLogin = async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = await User.findOne({ email: email });
    if (admin) {
    if (admin.is_admin === 1) {
      const passwordMatch = await bcrypt.compare(password, admin.password);
      if (passwordMatch) {
        req.session.admin = {
          _id: admin._id,
          email: admin.email,
          name: admin.name,
        };
        res.redirect('/admin/home');
      } else {
        req.flash('error', 'Incorrect password.');
        res.redirect('/admin/');
      }
    } else {
      req.flash('error', 'You are not an admin.');
      res.redirect('/admin/');
    }
  } else {
    req.flash('error', 'Not registered.');
    res.redirect('/admin/');
  }
} catch (err) {
  console.error(err.message);
  res.status(500).send('Error verifying login');
}
   };


   //  Load the dashboard page

   const loadDashboard = async (req, res) => {
    try {

        res.render('adminDashboard');
    } catch (error) {
        console.log(error.message)
    }
}

// Admin Logout

const adminLogout = async (req, res) => {
  try {
      req.session.admin = false;
      res.redirect('/admin/')
  } catch (err) {
      console.log(err.message)
  }
}



// =========================================< User Management >=================================================//


  

// Load users list

const loadUserMangment = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 5;
    const skip = (page - 1) * limit;
    let search = '';
    if (req.query.search) {
      search = req.query.search;
    }
    const userData = await User.find({
      is_admin: 0,
      name: { $regex: '.*' + search + '.*', $options: 'i' }
    })
    .skip(skip)
    .limit(limit);

    // Query to count total filtered users
    const totalUsers = await User.countDocuments({
      is_admin: 0,
      name: { $regex: '.*' + search + '.*', $options: 'i' }
    });

    res.render('userManagement', {
      users: userData,
      page,
      totalPages: Math.ceil(totalUsers / limit),
      limit,
      totalUsers
    });
  } catch (err) {
    console.log(err.message);
    res.status(500).send("Server Error");
  }
};


const blockUser = async (req, res) => {
  try {

      const {userId} = req.body
      const userData = await User.findById(userId)

      await User.findByIdAndUpdate(
          userId,
          {
              $set:{
                  is_blocked:!userData.is_blocked
              }
          }
      )
      res.json({block: true})

  } catch (error) {
      console.log(error.message);

  }
}




const loadOrderlist = async (req, res) => {
  try {
    const perPage = 10; // Number of orders per page
    const page = parseInt(req.query.page) || 1; // Current page, default to 1

    const totalOrders = await Order.countDocuments(); // Total number of orders
    const totalPages = Math.ceil(totalOrders / perPage); // Total number of pages

    const orders = await Order.find({})
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('userId', 'name')
      .populate('products.productId', 'name');

    res.render('orderList', {
      orders,
      currentPage: page,
      totalPages,
      previous: page > 1 ? page - 1 : 1,
      next: page < totalPages ? page + 1 : totalPages
    });
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Server Error');
  }
};



const orderDetails = async (req, res) => {
  try {
    const orderId = req.params.orderId;
    const order = await Order.findById(orderId)
      .populate('userId')
      .populate('products.productId')
      

    if (!order) {
      return res.status(404).send('Order not found');
    }
      // Calculate the subtotal
      const subtotal = order.products.reduce((sum, productItem) => {
        return sum + (productItem.price * productItem.quantity);
      }, 0);

    res.render('orderDetails', { order,subtotal });
  } catch (error) {
    console.log(error.message);
    res.status(500).send('Server Error');
  }
}; 

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId, productId, status } = req.body;

    // Define allowed transitions
    const allowedTransitions = {
      'Pending': ['Dispatched'],
      'Dispatched': ['Out For Delivery'],
      'Out For Delivery': ['Delivered'],
      'Delivered': [] // No further transitions allowed
    };

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const productItem = order.products.id(productId);
    if (!productItem) {
      return res.status(404).json({ message: 'Product not found in order' });
    }

    const currentStatus = productItem.status;
    if (allowedTransitions[currentStatus] && !allowedTransitions[currentStatus].includes(status)) {
      return res.status(400).json({ 
        message: `Invalid status transition from ${currentStatus} to ${status}.` 
      });
    }

    productItem.status = status;
    await order.save();

    res.status(200).json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};




module.exports = {
    loadLogin,
    verifyLogin,
    loadDashboard,
    adminLogout,
    loadUserMangment,
    blockUser,
    loadOrderlist,
    orderDetails,
    updateOrderStatus,
    
    
    
}