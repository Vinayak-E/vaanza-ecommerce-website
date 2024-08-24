const User = require("../models/userModel");
const Address = require("../models/addressSchema")
const Order = require("../models/orderModel");
const Wallet = require("../models/walletModel");
const Product = require("../models/productSchema");
const Offer = require("../models/offerModel");
const Cart =require("../models/cartSchema")
const userOtpVerification = require('../models/userOTPverification')
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const Token = require('../models/tokenModel');
const crypto = require("crypto");
const pdf = require('html-pdf');










const getBestOffer = (product, offers) => {
  if (!offers || offers.length === 0) {
    return null;
  }

  const relevantOffers = offers.filter(offer => 
    (offer.type === 'category' && offer.category.some(c => c.category.toString() === product.category._id.toString())) ||
    (offer.type === 'product' && offer.products.some(p => p.productId.toString() === product._id.toString())) 
  );

  const activeOffers = relevantOffers.filter(offer => offer.status);

  const bestOffer = activeOffers.reduce((maxOffer, offer) => offer.discount > maxOffer.discount ? offer : maxOffer, { discount: 0 });

  return bestOffer.discount > 0 ? bestOffer : null;
};

// Load home page
const loadHome = async (req, res) => {
  try {
    let cartCount = 0;
    let user = null;

    if (req.session.user) {
      user = req.session.user;

      // Fetch the cart for the logged-in user
      const cart = await Cart.findOne({ userId: user._id });

      if (cart && cart.products) {
        // Calculate the total count of items in the cart
        cartCount = cart.products.reduce((acc, product) => acc + product.quantity, 0);
      }
    }

    // Fetch the regular products
    const products = await Product.find({ is_Listed: true })
      .populate('category')
      .populate('offers')
      .exec();

    // Fetch the new arrival products (added within the last 7 days)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const newArrivalProducts = await Product.find({
      is_Listed: true,
      date: { $gte: oneWeekAgo }
    })
    .populate('category')
    .populate('offers')
    .exec();

    const offers = await Offer.find({ status: true });

    // Add the best offer to each product
    const productsWithBestOffer = products.map(product => {
      const bestOffer = getBestOffer(product, offers);
      return { ...product.toObject(), bestOffer, isNew: product.createdAt >= oneWeekAgo };
    });

    const newArrivalProductsWithBestOffer = newArrivalProducts.map(product => {
      const bestOffer = getBestOffer(product, offers);
      return { ...product.toObject(), bestOffer, isNew: true };
    });

    // Render the home page with user, cartCount, and products data
    res.render("home", { user, cartCount, products: productsWithBestOffer, newArrivalProducts: newArrivalProductsWithBestOffer });
  } catch (error) {
    console.log(error);
    res.status(500).send("Internal Server Error");
  }
};

//load login page 
const loadLogin = async (req, res) => {
  try {
    res.render("login");
  } catch (error) {
    console.log(error);
  }
};


// ======================================Ueser sign UP and otp verification ==============================================  \\

// Load sign up page
const loadRegister = async (req,res) => {
  try {
    res.render("register");
  } catch (error) {
    console.log(error);
  }
};

// Secure password using bcrypt
const securePassword = async (password) => {
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    return passwordHash;
  } catch (error) {
    console.log(error.message);
  }
};

const generateReferralCode = () => {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};




// Function to create or update wallet
const updateWallet = async (userId, amount) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = new Wallet({
      user: userId,
      balance: amount,
      transactions: [{
        amount: amount,
        transactionId: crypto.randomBytes(8).toString('hex'),
        productName: 'Referral Bonus',
        type: 'credit'
      }]
    });
  } else {
    wallet.balance += amount;
    wallet.transactions.push({
      amount: amount,
      transactionId: crypto.randomBytes(8).toString('hex'),
      productName: 'Referral Bonus',
      type: 'credit'
    });
  }
  await wallet.save();
};


// Insert user and send OTP
const insertUser = async (req, res) => {
  try {
    const { name, email, mobile, password, referralCode } = req.body;
    const findUserByEmail = await User.findOne({email});
    if (findUserByEmail) {
      req.flash('exist', 'User already exists with this email');
      res.redirect('/register');
    } else {
      const securePass = await securePassword(req.body.password);

      const newUserReferralCode = generateReferralCode();
    
      const user = new User({
        name,
        email,
        mobile,
        password: securePass,
        is_admin: 0,
        is_blocked: 0,
        verified: false,
        referralCode: newUserReferralCode,
      });

      await user.save();

      if (referralCode) {
        const referrer = await User.findOne({ referralCode });
        if (referrer) {
          // Add bonus to referrer's wallet
          await updateWallet(referrer._id, 100);
          
          // Add bonus to new user's wallet
          await updateWallet(user._id, 50);
        }
      }

      sendOTPverificationEmail(user, res);
      
    }
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
};

// Send OTP verification email

const sendOTPverificationEmail = async ({email}, res) => {
  try {
    let transporter = nodemailer.createTransport({
          service: 'gmail',
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
              user: process.env.email_admin,
              pass: process.env.smtp_password
          }
      });

      otp = `${Math.floor(1000 + Math.random() * 9000)}`;
       // mail options
       const mailOptions = {
        from: process.env.email_admin,
        to: email,
        subject: "Verify Your EMAIL Address",
        html: `Your OTP is: ${otp}`
    };
     // hash the otp
     const saltRounds = 10;
     const hashedOTP = await bcrypt.hash(otp, saltRounds);

     const newOtpVerification = await new userOtpVerification({email: email, otp: hashedOTP});
     // save otp record
     await newOtpVerification.save();
     await transporter.sendMail(mailOptions);
     console.log(otp)
     res.redirect(`/otp?email=${email}`);

 } catch (err) {
     console.log(err.message);
 }
};
const loadOtp = async (req, res) => {
  try {
      const email = req.query.email;
      res.render('otpVerification', {email: email});

  } catch (error) {
      console.log(error);

  }
}
const verifyOtp = async (req, res) => {
  try {
      const { email, digit1, digit2, digit3, digit4 } = req.body;
      const otp = digit1 + digit2 + digit3 + digit4;

      const userVerification = await userOtpVerification.findOne({ email });

      if (!userVerification) {
          req.flash('error', 'OTP expired or invalid');
          return res.redirect(`/otp?email=${email}`);
      }

      const { otp: hashedOtp } = userVerification;
      const validOtp = await bcrypt.compare(otp, hashedOtp);

      if (validOtp) {
          const userData = await User.findOne({ email });

          if (userData) {
              await User.findByIdAndUpdate(
                  {
                      _id: userData._id,
                  },
                  {
                      $set: {
                          verified: true,
                      },
                  }
              );
          }

          // Delete the OTP record after verification
          await userOtpVerification.deleteOne({ email });

          // Handle user verification and session management
          const user = await User.findOne({ email });
          if (user && user.verified && !user.is_blocked) {
              req.session.user = {
                  _id: user._id,
                  email: user.email,
                  name: user.name,
              };
              return res.redirect('/');
          } else if (user && user.is_blocked) {
              req.flash('error', 'You are blocked from accessing this account. Please contact admin.');
              return res.redirect('/login');
          } else {
              req.flash('error', 'User not found or verification failed.');
              return res.redirect('/login');
          }
      } else {
          req.flash('error', 'OTP is incorrect. Please verify OTP again.');
          return res.redirect(`/otp?email=${email}`);
      }
  } catch (error) {
      console.log(error);
      req.flash('error', 'An error occurred while verifying OTP.');
      return res.redirect('/login');
  }
};



// /////////////////////// resend otp
const resendOtp = async (req, res) => {
  try {

      const userEmail = req.query.email;
      await userOtpVerification.deleteMany({email: userEmail});
      if (userEmail) {
          sendOTPverificationEmail({
              email: userEmail
          }, res);
      } else {
      }

  } catch (error) {
      console.log(error);

  }
}


// Login verification
const verifyLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash('error', 'No users found');
      return res.redirect('/login');
    }

    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      req.flash('error', 'Incorrect password.');
      return res.redirect('/login');
    }

    if (!user.verified) {
      req.flash('error', 'Email not verified. Please check your email for the OTP.');
      return sendOTPverificationEmail(user, res);
    }

    if (user.is_blocked) {
      req.flash('error', 'You are blocked from this site. Please contact the admin.');
      return res.redirect('/login');
    }

    req.session.user = {
      _id: user._id,
      email: user.email,
      name: user.name,
      phone: user.mobile

    };

    res.redirect('/');
  } catch (error) {
    console.error('Error during login verification:', error);
    res.status(500).send("Internal Server Error");
  }
};

// user logout

const userLogout = async (req, res) => {
  try {
      req.session.user = false
      res.redirect('/')

  } catch (err) {
      console.log(err.message)
  }
}


// forget password
const loadForgetpass = async (req, res) => {
  try {
      res.render('forgottenPass')
  } catch (err) {
      console.log(err.message)
  }
}
const sendResetPass = async (email, res) => {
  try {
      email = email
      const user = await User.findOne({email: email});
      if (! user) 
      return res.render('forgottenPass', { error: "User with the given email doesn't exist" });
      let token = await Token.findOne({userId: user._id});
      if (! token) {
          token = await new Token({userId: user._id, token: crypto.randomBytes(32).toString("hex")}).save();
      }

      let transporter = nodemailer.createTransport({
          service: 'gmail',
          host: 'smtp.gmail.com',
          port: 465,
          secure: true,
          auth: {
              user: process.env.email_admin,
              pass: process.env.smtp_password
          }
      });

      const resetpage = `http://vaanza.shop:3000/resetPassword/${user._id}/${token.token}`;

      const mailOptions = {
          from: process.env.email_admin,
          to: email,
          subject: "Verify Your email",
          html: `Your link here to reset pass ${resetpage}`
      };
      await transporter.sendMail(mailOptions);


  } catch (err) {
      console.log(err.message);
  }
};


const sentResetpass = async (req, res) => {
  try {
      const email = req.body.mail;
      await sendResetPass(email, res);
      req.flash('success', 'we sented a reset password link');
      res.redirect('/login')

  } catch (err) {
      console.log(err.message)
  }
}

// reset password page link

const resetPage = async (req, res) => {
  try {
      const userId = req.params.userId;
      const token = req.params.token;
      res.render('resetPassword', {
          userId,
          token
      })
  } catch (err) {
      console.log(err.message)
  }
}
const resetPassword = async (req, res) => {
  try {
      const user = req.body.userId;
      const userId = await User.findById(req.body.userId);
      const { email } = userId;
      const token = req.body.token;

      if (! userId) {
          return res.status(400).send("Invalid link or expired");
      }
      const tokenDoc = await Token.findOne({
          userId: userId._id, // Use userId._id directly
          token: token
      });
 
      if (! tokenDoc) {
          return res.status(400).send("Invalid link or expired");
      }
      let password = req.body.confirmpassword;
      const securePass = await securePassword(password);
      await User.updateOne({
          email: email
      }, {
          $set: {
              password: securePass
          }
      });
      req.flash('success', 'Your password changed successfully');
      res.redirect('/login')

  } catch (err) {
      console.log(err.message);
      res.status(500).send("Internal Server Error");
  }
};



// =========================================< Profile >=================================================

const loadProfile = async (req, res) => {
  try {

    const userId = req.session.user._id; 
    console.log(userId)
    const user = await User.findById(userId).lean();
    const wallet = await Wallet.findOne({ user:userId });
    const addresses = await Address.find({ user: userId }).lean();
    const orders = await Order.find({ userId })
    .populate({
      path: 'products.productId',
      populate: { path: 'variants' }
    }).sort({ orderDate: -1 });


    const hasDeliveredProduct = orders.some(order => 
      order.products.some(product => 
          product.status === 'Delivered' || product.status === 'Return Requested' || product.status === 'Returned'
      )
  );
  let cartCount = 0;


  if (req.session.user) {


    // Fetch the cart for the logged-in user
    const cart = await Cart.findOne({ userId: user._id });

    if (cart && cart.products) {
      // Calculate the total count of items in the cart
      cartCount = cart.products.reduce((acc, product) => acc + product.quantity, 0);
    }
  }
      res.render('profilePage', { user, addresses,orders,wallet, hasDeliveredProduct,cartCount  })

  } catch (err) {
      console.log(err.message)
  }
}



const editProfile = async (req, res) => {
  try {
      const { updatedEmail, updatedName, updatedMobile } = req.body;
      const userId = req.session.user._id;

      const existingUser = await User.findOne({ email: updatedEmail });
      if (existingUser && existingUser._id.toString() !== userId) {
          return res.json({ edited: false, message: 'Email already exists.' });
      }

      const updatedUser = await User.findByIdAndUpdate(
          userId,
          { 
              name: updatedName, 
              email: updatedEmail, 
              mobile: updatedMobile 
          },
          { new: true }
      );

      req.session.user = {
          _id: updatedUser._id,
          email: updatedUser.email,
          name: updatedUser.name,
          phone: updatedUser.mobile
      };

      res.json({ edited: true, user: updatedUser });
  } catch (err) {
      console.error(err.message);
      res.status(500).json({ edited: false, message: "Server error" });
  }
};


const resetPasswithOld = async (req, res) => {
  try {
      const { confirmPass, useremail, oldPass } = req.body;

      // Validate incoming data
      if (!confirmPass || !useremail || !oldPass) {
          return res.status(400).json({ error: 'All fields are required' });
      }

      // Find the user by email
      const user = await User.findOne({ email: useremail });
      if (!user) {
          return res.status(404).json({ error: 'User not found' });
      }


      // Compare old password with the stored hashed password
      const passwordMatch = await bcrypt.compare(oldPass, user.password);
      if (!passwordMatch) {
          return res.status(400).json({ res: false, message: 'Incorrect old password' });
      }

      // Check if the new password is the same as the old password
      const passwordSame = await bcrypt.compare(confirmPass, user.password);
      if (passwordSame || confirmPass === oldPass) {
          return res.status(400).json({ reseted: false, message: 'New password should be different from the old password' });
      }

      // Hash the new password and update it in the database
      const securePass = await securePassword(confirmPass);
      await User.findOneAndUpdate({ email: useremail }, { $set: { password: securePass } });

      res.status(200).json({ reseted: true, message: 'Password successfully updated' });
  } catch (err) {
      console.log(err.message);
      res.status(500).json({ error: 'Internal server error' });
  }
};



 const addAddress = async (req, res) => {

  try {
      const { name, number, address, street, postalCode, state, landmark } = req.body;
      console.log(req.body)

      const newAddress = new Address({
          name,
          number,
          address,
          street,
          postalCode,
          state,
          landmark,
          user: req.session.user._id  // Assuming the user is logged in and available in req.user
      });

      await newAddress.save();
      res.json({ success: true });

  } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, message: 'Server Error' });
  }
};



const editAddress = async (req, res) => {
  try {
      const {id, name, number, address, street, postalCode, state, landmark } = req.body;
      
      const updatedAddress = await Address.findOneAndUpdate(
          { _id: id, user: req.session.user._id },
          {
              $set: {
                  name,
                  number,
                  address,
                  street,
                  postalCode,
                  state,
                  landmark
              }
          },
          { new: true } // Return the updated document
      );

      if (updatedAddress) {
          res.json({ success: true });
      } else {
          res.status(404).json({ success: false, message: 'Address not found or user unauthorized' });
      }                           
  } catch (err) {
      console.error(err.message);
      res.status(500).json({ success: false, message: 'Server Error' });
  }
};


 const removeAddress = async (req, res) => {

  const addressId = req.params.id;
   console.log(addressId)
  try {
      // Find the address by ID and delete it
      const deletedAddress = await Address.findOneAndDelete({ _id: addressId, user: req.session.user._id });

      if (!deletedAddress) {
          return res.status(404).json({ success: false, message: 'Address not found or user unauthorized' });
      }

      res.json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
      console.error('Error deleting address:', error);
      res.status(500).json({ success: false, message: 'Server error' });
  }
};




const downloadInvoice = async (req, res) => {
  try {
      const user = req.session.user;
      const { orderId } = req.body;
      
      console.log("helloooo",req.body)
      const order = await Order.findOne({orderId}).populate('products.productId');
      console.log("order found",order)
     
      const products = order.products.filter(item =>
          ['Delivered', 'Return Requested', 'Returned'].includes(item.status)
      );
 console.log("products found",products)
      let discount = 0;

      const subtotal = order.products.reduce((sum, item) => sum + (item.price * item.quantity), 0);

      const shipping = subtotal < 500 ? 50 : 0;
      const totalAmount = order.totalAmount;
      if (!isNaN(order.coupon)) {
          const couponDiscount = subtotal * order.coupon.discount / 100;
          discount = couponDiscount <= order.coupon.maxAmount ? couponDiscount: order.coupon.maxAmount;
      }

      console.log('order.coupon: ', isNaN(order.coupon));
      
      const summary = {
          subtotal: subtotal,
          shipping: shipping,
          totalAmount: totalAmount,
          discount: discount
      };

      console.log('summary: ', summary);
      

      if (!order) {
          return res.status(404).send('Order not found');
      }
      
      const paymentMethod = order.paymentMethod
      res.render('invoice',{ user, order, paymentMethod, products, summary }, (err, html) => {
          if (err) {
              console.error('Error rendering invoice template:', err);
              return res.status(500).send('Error generating invoice');
          }

          pdf.create(html, {}).toBuffer((err, buffer) => {
              if (err) {
                  console.error('Error generating PDF:', err);
                  return res.status(500).send('Error generating PDF');
              }

              res.setHeader('Content-Disposition', 'attachment; filename=invoice.pdf');
              res.setHeader('Content-Type', 'application/pdf');
              res.send(buffer);
          });
      });
  } catch (err) {
      console.error('Error fetching order details:', err);
      res.status(500).send('Internal server error');
  }
};


const loadAbout = async(req,res)=>{
  try{

    let cartCount = 0;
    let user = null;

    if (req.session.user) {
      user = req.session.user;

      // Fetch the cart for the logged-in user
      const cart = await Cart.findOne({ userId: user._id });

      if (cart && cart.products) {
        // Calculate the total count of items in the cart
        cartCount = cart.products.reduce((acc, product) => acc + product.quantity, 0);
      }
    }

    res.render("about",{cartCount})
  }catch (err) {
    console.error('Error fetching order details:', err);
    res.status(500).send('Internal server error');
}
}

const loadContact = async(req,res)=>{
  try{

    let cartCount = 0;
    let user = null;

    if (req.session.user) {
      user = req.session.user;

      // Fetch the cart for the logged-in user
      const cart = await Cart.findOne({ userId: user._id });

      if (cart && cart.products) {
        // Calculate the total count of items in the cart
        cartCount = cart.products.reduce((acc, product) => acc + product.quantity, 0);
      }
    }

    res.render("contact",{cartCount})
  }catch (err) {
    console.error('Error fetching order details:', err);
    res.status(500).send('Internal server error');
}
}

module.exports = {
  
  loadRegister,
  loadHome,
  loadLogin,
  insertUser,
  verifyOtp,
  loadOtp,
  resendOtp,
  verifyLogin,
  userLogout,
  loadForgetpass,
  sentResetpass,
  resetPassword,
  resetPage,
  loadProfile,
  editProfile,
  resetPasswithOld,
  addAddress,
  editAddress,
  removeAddress,
  downloadInvoice,
  loadAbout,
 loadContact 

  
  

 
};
