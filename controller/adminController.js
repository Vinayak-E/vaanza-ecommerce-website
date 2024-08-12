const {name} = require('ejs');
const User = require('../models/userModel');
const bcrypt = require('bcrypt'); 
const Address = require("../models/addressSchema")
const Order = require("../models/orderModel");
const Product = require("../models/productSchema");
const Wallet = require("../models/walletModel");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');


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
    const search = req.query.search; // Get the search term from the query

    // Define a query object
    let query = {};

    // If a search term is provided, search by orderId
    if (search) {
      query = { orderId: { $regex: search, $options: 'i' } };
    }

    const totalOrders = await Order.countDocuments(query); // Total number of orders matching the query
    const totalPages = Math.ceil(totalOrders / perPage); // Total number of pages

    const orders = await Order.find(query)
      .skip((page - 1) * perPage)
      .limit(perPage)
      .populate('userId', 'name')
      .populate('products.productId', 'name');

    res.render('orderList', {
      orders,
      currentPage: page,
      totalPages,
      previous: page > 1 ? page - 1 : 1,
      next: page < totalPages ? page + 1 : totalPages,
      search // Pass the search term back to the view to maintain it in the input field
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


const handleReturnRequest = async (req, res) => {
  try {
    const { orderId, productId, action } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const productItem = order.products.id(productId);
    if (!productItem) {
      return res.status(404).json({ message: 'Product not found in order' });
    }

    if (productItem.status !== 'Return Requested') {
      return res.status(400).json({ message: 'No return request found for this product' });
    }

    if (action === 'accept') {
      // Update productItem status to 'Returned'
      productItem.status = 'Returned';

      // Find the original product and variant to update the stock quantity
      const originalProduct = await Product.findById(productItem.productId);
      const variant = originalProduct.variants.id(productItem.variantId);
      if (!variant) {
        return res.status(404).json({ message: 'Variant not found in the product' });
      }

      // Increase the variant quantity by the returned product's quantity
      variant.quantity += productItem.quantity;
      await originalProduct.save();

      // Add money back to the user's wallet
      const productPurchasePrice = productItem.price;
      const userId = order.userId;  // Extract user ID from the order
      let wallet = await Wallet.findOne({ user: userId });

      if (!wallet) {
        wallet = new Wallet({
          user: userId,
          balance: 0,
          transactions: []
        });
        await wallet.save();
      }

      wallet.balance += productPurchasePrice;
      await wallet.save();
    } else if (action === 'reject') {
      productItem.status = 'Delivered'; // Revert status to 'Delivered'
    }

    await order.save();

    res.status(200).json({ message: `Return request ${action}ed successfully` });
  } catch (error) {
    console.error(error.message);
    res.status(500).json({ message: 'Server Error' });
  }
};




const loadSalesReport = async (req, res) => {
  try {
      res.render('salesReport');
  } catch (err) {
      console.error('Error fetching sales report: ', err);
      res.status(500).send('Internal server error');
  }
}


const generateSalesReport = async (req, res) => {
  const { reportType, startDate, endDate } = req.body;

  let filter = {};
  const currentDate = new Date();

  switch (reportType) {
      case 'daily':
          filter.orderDate = {
              $gte: new Date(currentDate.setHours(0, 0, 0, 0)),
              $lte: new Date(currentDate.setHours(23, 59, 59, 999))
          };
          console.log('Daily Filter:', filter.orderDate);
          break;
      case 'weekly':
          const today = new Date();
          const firstDayOfWeek = today.getDate() - today.getDay();
          const lastDayOfWeek = firstDayOfWeek + 6;

          const startOfWeek = new Date(today.setDate(firstDayOfWeek));
          startOfWeek.setHours(0, 0, 0, 0);

          const endOfWeek = new Date(today.setDate(lastDayOfWeek));
          endOfWeek.setHours(23, 59, 59, 999);

          filter.orderDate = { $gte: startOfWeek, $lte: endOfWeek };
          console.log('Weekly Filter:', filter.orderDate);
          break;
      case 'monthly':
          const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          endOfMonth.setHours(23, 59, 59, 999);
  
          filter.orderDate = { $gte: startOfMonth, $lte: endOfMonth };
          console.log('Monthly Filter:', filter.orderDate);
          break;
      case 'custom':
          if (startDate && endDate) {
              filter.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
              console.log('Custom Filter:', filter.orderDate);
          }
          break;
  }

  try {
      const orders = await Order.find(filter).populate('products.productId');

      let totalOrders = 0;
      let totalSales = 0;
      let totalDiscounts = 0;

      const report = orders.map(order => {
          const filteredProducts = order.products.filter(item => item.status === 'Delivered' || item.status === 'Return Requested');
     
          if (filteredProducts.length > 0) {
              let discountAmount = order.coupon !== null ? order.totalAmount * order.coupon.discount / 100 : 0;
              if (discountAmount > order.coupon.maxAmount) {
                  discountAmount = order.coupon.maxAmount;
              }
              const orderTotal = filteredProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
              totalSales += orderTotal;
              totalDiscounts += isNaN(discountAmount) ? 0 : discountAmount;
              totalOrders++;
              return {
                  orderId: order.orderId,
                  orderDate: order.orderDate,
                  totalAmount: orderTotal,
                  discountAmount: isNaN(discountAmount) ? 0 : discountAmount,
                  products: filteredProducts.map(item => ({
                    
                      quantity: item.quantity,
                      productName: item.productId.name,
                      price: item.price,
                      status: item.status
                  }))
              };
          }
      }).filter(order => order); // Filter out undefined values

      res.json({
          totalOrders,
          totalSales: totalSales - totalDiscounts,
          totalDiscounts,
          orders: report
      });
  } catch (error) {
      console.error('Error generating sales report:', error);
      res.status(500).send('Internal server error');
  }
}


const generatePDF = (reportData) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    let buffers = [];
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      resolve(pdfBuffer);
    });

    // Helper function to format currency
    const formatCurrency = (amount) => `₹${parseFloat(amount).toFixed(2)}`;

    // Add a header
    doc.fontSize(20).font('Helvetica-Bold').text('Sales Report', { align: 'center' });
    doc.moveDown();

    // Add report summary
    doc.fontSize(12).font('Helvetica-Bold').text('Report Summary');
    doc.fontSize(10).font('Helvetica')
      .text(`Total Orders: ${reportData.totalOrders}`)
      .text(`Total Sales Amount: ${formatCurrency(reportData.totalSales)}`)
   
    
    doc.moveDown();

    // Add order details
    doc.fontSize(12).font('Helvetica-Bold').text('Order Details');
    doc.moveDown(0.5);

    reportData.orders.forEach((order, index) => {
      // Add a light gray background for every other order
      if (index % 2 === 0) {
        doc.rect(50, doc.y, 500, 100).fill('#f0f0f0');
        doc.fill('#000000');
      }

      doc.fontSize(10).font('Helvetica-Bold')
        .text(`Order ID: ${order.orderId}`, { continued: true })
        .text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`, { align: 'right' });
      
      doc.fontSize(10).font('Helvetica')
        .text(`Total Amount: ${formatCurrency(order.totalAmount)}`, { continued: true })
        .text(`Discount: ${formatCurrency(isNaN(order.discountAmount) ? 0 : order.discountAmount)}`, { align: 'right' });
      
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').text('Products:');
      order.products.forEach(product => {
        doc.fontSize(9).font('Helvetica')
          .text(`${product.productName}: ${product.quantity} x ${formatCurrency(product.price)} = ${formatCurrency(product.quantity * product.price)}`, { indent: 20 });
      });
      
      doc.moveDown();
    });

    // Add page numbers
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      doc.fontSize(8).text(`Page ${i + 1} of ${totalPages}`, 50, doc.page.height - 50, { align: 'center' });
    }

    doc.end();
  });
};

const generateExcel = async (reportData) => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Sales Report');

  sheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 20 },
      { header: 'Order Date', key: 'orderDate', width: 20 },
      { header: 'Total Amount', key: 'totalAmount', width: 15 },
      { header: 'Discount Amount', key: 'discountAmount', width: 15 },
      { header: 'Product Name', key: 'productName', width: 30 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Price', key: 'price', width: 15 },
  ];

  reportData.orders.forEach(order => {
      order.products.forEach(product => {
          sheet.addRow({
              orderId: order.orderId,
              orderDate: new Date(order.orderDate).toLocaleDateString(),
              totalAmount: order.totalAmount,
              discountAmount: isNaN(order.discountAmount) ? 0 : order.discountAmount,
              productName: product.productName,
              quantity: product.quantity,
              price: product.price
          });
      });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};



const downloadSalesReport =  async (req, res) => {
  const { format, reportType, startDate, endDate } = req.query;
  console.log("query",req.query)

  const reportData = await generateReportData(reportType, startDate, endDate);

  if (format === 'pdf') {
      const pdfBuffer = await generatePDF(reportData);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=sales_report.pdf');
      res.send(pdfBuffer);
  } else if (format === 'excel') {
      const excelBuffer = await generateExcel(reportData);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=sales_report.xlsx');
      res.send(excelBuffer);
  } else {
      res.status(400).send('Invalid format');
  }
}


const generateReportData = async (reportType, startDate, endDate) => {
  let filter = {};
  const currentDate = new Date();

  switch (reportType) {
      case 'daily':
          filter.orderDate = { $gte: new Date(currentDate.setHours(0, 0, 0, 0)), $lte: new Date(currentDate.setHours(23, 59, 59, 999)) };
          break;
      case 'weekly':
          const weekStartDate = new Date(currentDate.setDate(currentDate.getDate() - currentDate.getDay()));
          const weekEndDate = new Date(weekStartDate);
          weekEndDate.setDate(weekStartDate.getDate() + 6);
          weekEndDate.setHours(23, 59, 59, 999);
          filter.orderDate = { $gte: weekStartDate, $lte: weekEndDate };
          break;
      case 'monthly':
          const monthStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const monthEndDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
          monthEndDate.setHours(23, 59, 59, 999);
          filter.orderDate = { $gte: monthStartDate, $lte: monthEndDate };
          break;
      case 'custom':
          if (startDate && endDate) {
              filter.orderDate = { $gte: new Date(startDate), $lte: new Date(endDate) };
          }
          break;
  }

  const orders = await Order.find(filter).populate('products.productId');

  let totalSales = 0;
  let totalDiscounts = 0;
  let totalOrders = 0;

  const report = orders.map(order => {
      const filteredProducts = order.products.filter(item => item.status === 'Delivered' || item.status === 'Return Requested');
      
      if (filteredProducts.length > 0) {
          let discountAmount = 0;
          
          if (order.coupon) {
              discountAmount = (order.totalAmount * order.coupon.discount) / 100;
              if (discountAmount > order.coupon.maxAmount) {
                  discountAmount = order.coupon.maxAmount;
              }
          }

          const orderTotal = filteredProducts.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          
          totalSales += orderTotal;
          totalDiscounts += discountAmount;
          totalOrders++;

          return {
              orderId: order.orderId,
              orderDate: order.orderDate,
              totalAmount: orderTotal,
              discountAmount: discountAmount,
              products: filteredProducts.map(item => ({
                  productName: item.productId.name,
                  quantity: item.quantity,
                  price: item.price,
                  status: item.status
              }))
          };
      } else {
          return null;
      }
  }).filter(order => order !== null);

  return {
      totalOrders: totalOrders,
      totalSales: totalSales,
      totalDiscounts: totalDiscounts,
      orders: report
  };
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
   handleReturnRequest,
   loadSalesReport,
   generateSalesReport,
   downloadSalesReport,
   generateReportData,
    
    
    
}