let blockCheckUtil =require('../utils/blockChecking.js');
const isLogin = async (req, res, next) => {
  try {
    if (req.session.user) {
      // User is logged in
      next();
    } else {
      // User is not logged in
      if (req.path !== "/login") {
        res.redirect("/login");
        return;
      }
      next();
    }
  } catch (error) {
    console.error("Error in authentication middleware:", error.message);
    next(error); // Passes error to the next middleware or error handler
  }
};


const isLogOut = async (req, res, next) => {
  try {
    // check if the user is logged in
    if (req.session.user) {
      // if the user is logged in ,redirect to home
      res.redirect("/");
      return;
    }
    next();
  } catch (error) {
    console.log(error.message);
  }
};
const authlogg = async (req, res, next) => {
  try {
    if (req.session.user) {
      next();
    } else {
      res.redirect("/login");
    }
  } catch (err) {
    console.log(err.message);
  }
};

const userBlockCheck = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const blocked = await blockCheckUtil.blockChecking(userId);
    if (!blocked) {
      next();
    } else {
      req.session.user = false;
      res.redirect("/login");
    }
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ message: "internal server error" });
  }
};
module.exports = {
  isLogin,
  isLogOut,
  authlogg,
  userBlockCheck,
};