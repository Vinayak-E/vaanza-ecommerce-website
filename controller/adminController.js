const {name} = require('ejs');
const User = require('../models/userModel');
const bcrypt = require('bcrypt'); 

const securePassword = async (password) => {
    try {
        const securePass = await bcrypt.hash(password, 10);
        return securePass;
    } catch (err) {
        console.log(err.message)
    }
} 

const loadLogin = async (req, res) => {
    try {
        res.render('adminLogin');
    } catch (error) {
        console.log(error.message)
    }
}



const verifyLogin = async (req, res) => {
    try {
      const { email, password } = req.body;
      const admin = await User.findOne({ email: email });
    if (admin) {
    console.log(`Admin found: ${admin.name}`);
    if (admin.is_admin === 1) {
      console.log(`Admin role: ${admin.is_admin}`);
      const passwordMatch = await bcrypt.compare(password, admin.password);
      console.log(`Password match: ${passwordMatch}`);
      if (passwordMatch) {
        req.session.admin = {
          _id: admin._id,
          email: admin.email,
          name: admin.name,
        };
        console.log(`Session set: ${req.session.admin.name}`);
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
const loadDashboard = async (req, res) => {
    try {

        res.render('adminDashboard');
    } catch (error) {
        console.log(error.message)
    }
}
const adminLogout = async (req, res) => {
  try {
      req.session.admin = false;

      res.redirect('/admin')

  } catch (err) {
      console.log(err.message)
  }
}


// =========================================< User Management >=================================================


  

// to load users
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


module.exports = {
    loadLogin,
    verifyLogin,
    loadDashboard,
    adminLogout,
    loadUserMangment,
    blockUser
    
    
}