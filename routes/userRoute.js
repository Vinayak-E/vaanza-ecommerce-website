const express = require("express");
const userRoute = express();
const userController = require("../controller/userController");
const productController = require('../controller/productController')
const cartController = require('../controller/cartController')
const orderController =require('../controller/orderController')
const couponController = require('../controller/couponController')
const wishlistController = require('../controller/wishlistController')
const path =require("path")
const session = require("express-session");
const config = require('../config/config');
const auth = require('../middlewares/userAuth');
const passport =require("passport");


require("../passport")
userRoute.use(passport.initialize());
userRoute.use(passport.session());

userRoute.use(session({secret:config.sessionSecret,resave:false,
    saveUninitialized:false,}))
    
userRoute.use((req, res, next) => {
        res.locals.user = req.session.user || null;
        res.locals.loggedIn = req.session.user ? true : false;
        next();
    });

 userRoute.use(express.urlencoded({extended:true}));

// Set up view engine and views directory
userRoute.set("view engine", "ejs");
userRoute.set("views", path.join(__dirname, "../views/user"));

userRoute.use(express.static(path.join(__dirname,"../public")))
 
// Session middleware setup
userRoute.use(
  session({
    secret: "sessionscret",
    resave: false,
    saveUninitialized: true,
  })
); 

// load home
userRoute.get("/", userController.loadHome);




// Route to load register page
userRoute.get("/register",auth.isLogOut,userController.loadRegister);
userRoute.post('/register',userController.insertUser);

userRoute.get('/login',auth.isLogin,userController.loadLogin);
userRoute.post('/login',userController.verifyLogin)
userRoute.get('/logout',userController.userLogout)

userRoute.get('/otp',auth.isLogOut,userController.loadOtp);
userRoute.post('/otp',userController.verifyOtp);

userRoute.post('/resend',userController.resendOtp)  

// forget pass ///////
userRoute.get('/forgetpass',auth.isLogOut,userController.loadForgetpass);

userRoute.post('/forgetpass',userController.sentResetpass);
// userRouter.get('/resetpassword',userController.resetPage);
userRoute.get('/resetpassword/:userId/:token',auth.isLogOut,userController.resetPage);

userRoute.post('/resetpassword',userController.resetPassword);

// Google Authentication
userRoute.get("/auth/google", passport.authenticate("google",{ scope: ["email", "profile"] }));


//Auth Callback
userRoute.get("/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/login",
    failureFlash: true}),
    async (req,res)=>{

      req.session.user = req.user;
      res.redirect("/")
    }


  );
 
// =======================================< SHOP & PRODUCT DETAILD >============================================= //




userRoute.get('/shop/gender/:gender',productController.loadShop);

userRoute.get('/productView/product/:productId/variant/:variantId',productController.productView);



  

// ==========================================< CART HANDLING >==================================================== //

userRoute.get('/cart',auth.authlogg,auth.userBlockCheck,cartController.loadCart);

userRoute.post('/add-to-cart',cartController.addToCart)

userRoute.post('/update-cart-quantity',auth.authlogg,cartController.quantityUpdationCart)


userRoute.post('/remove-from-cart',auth.authlogg,cartController.removeCartItem)
 


// ==========================================< USER PROFILE >==================================================== //

userRoute.get('/profile',auth.authlogg,auth.userBlockCheck,userController.loadProfile);
userRoute.post('/editProfile',userController.editProfile)
userRoute.post('/reset-pass',userController.resetPasswithOld) 

userRoute.post('/add-address',userController.addAddress)
userRoute.post('/edit-address',userController.editAddress);

userRoute.post('/downloadInvoice',userController.downloadInvoice)
userRoute.delete('/delete-address/:id',userController.removeAddress);

 


// ==========================================< CHECKOUT >==================================================== //

userRoute.get('/checkout',auth.authlogg,auth.userBlockCheck,cartController.checkout);

userRoute.post('/place-order',auth.authlogg,orderController.placeOrder)
userRoute.post('/update-payment-status',orderController.updatePaymentStatus);

// In your Express route file
userRoute.post('/retry-payment',orderController.retryPayment);

userRoute.post('/cancel-order',orderController.cancelOrder)
userRoute.post('/return-order',orderController.returnOrder)

userRoute.get('/order-summary/:orderId',auth.authlogg,auth.userBlockCheck,orderController.orderSuccess)

userRoute.post('/applyCoupon/:couponCode',couponController.applyCoupon)




// ==========================================< Wishlist >==================================================== //

userRoute.get('/wishlist',auth.authlogg,auth.userBlockCheck,wishlistController.loadWishlist);

userRoute.post('/addToWishlist',auth.authlogg,auth.userBlockCheck, wishlistController.addToWishlist);
userRoute.delete('/removeFromWishlist', wishlistController.removeFromWishlist);




userRoute.get('/about',userController.loadAbout);
userRoute.get('/contact',userController.loadContact);

module.exports = userRoute;