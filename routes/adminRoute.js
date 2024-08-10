const express = require("express");
const adminRoute = express();
const session = require("express-session");
const adminController = require("../controller/adminController");
const dashboardController = require("../controller/dashboardController");
const categoryController = require("../controller/categoryController");
const productController = require("../controller/productController");
const cartController = require('../controller/cartController')
const offerController = require('../controller/offerController')
const couponController = require('../controller/couponController')


const config = require("../config/config");
const auth = require("../middlewares/adminAuth");
const path =require("path")
const multer = require("../middlewares/multerConfig");
// Set up view engine and views directory
adminRoute.set("view engine", "ejs");
adminRoute.set("views", path.join(__dirname, "../views/admin"));

adminRoute.use(express.static(path.join(__dirname,"../public/admin")))

adminRoute.use(session({secret:config.sessionSecret,resave:false,
  saveUninitialized:false,}))


  adminRoute.use(express.json());
  adminRoute.use(express.urlencoded({ extended: true }));
  
//admin load login

// Define a route for /admin that redirects to loadLogin
adminRoute.get("/",auth.isLogout,adminController.loadLogin);

adminRoute.post("/", adminController.verifyLogin);



adminRoute.get("/home",auth.isLogin,adminController.loadDashboard);
adminRoute.get("/logout",auth.isLogin,adminController.adminLogout);

// ===============User Management  ==========================//

adminRoute.get("/ums",auth.isLogin,adminController.loadUserMangment);
adminRoute.post("/blockUser", adminController.blockUser);



// =======    categotry managment   =======================//



adminRoute.get("/categories",auth.isLogin, categoryController.loadCategory);


adminRoute.get("/createCategory",auth.isLogin,categoryController.loadaAddCategory);

adminRoute.post("/categories", categoryController.insertCategory);



adminRoute.post("/list-unlist", categoryController.listUnlistCategory);

adminRoute.get("/edit-category",auth.isLogin,categoryController.editCategorypageLoad);

adminRoute.post("/edit-category", categoryController.editCategory);






// =======    Product managment   =======================//


adminRoute.get("/products",auth.isLogin, productController.loadProductList);


adminRoute.get("/addProduct",auth.isLogin, productController.loadAddproduct);

adminRoute.post( "/addproduct",multer.array("images"), productController.addProduct);

adminRoute.post('/listUnlistProduct', productController.listUnlistProduct);




adminRoute.post("/edit-product",productController.editProduct);

adminRoute.get("/loadVariant/:id", auth.isLogin,productController.loadVariant);


adminRoute.get("/addVariant",auth.isLogin, productController.loadAddVariant);


adminRoute.post("/addVariant",multer.array("images"), productController.addVariant);

adminRoute.get("/edit-variant",auth.isLogin,productController.loadEditVariant);

adminRoute.post("/edit-variant",multer.array('images', 4),productController.editVariant);





// ===============  Order Management  ==========================//

adminRoute.get("/orders",auth.isLogin,adminController.loadOrderlist)
adminRoute.get('/order-details/:orderId', adminController.orderDetails);

adminRoute.post('/update-status', adminController.updateOrderStatus);


adminRoute.post('/accept-return', adminController.handleReturnRequest);
adminRoute.post('/reject-return', adminController.handleReturnRequest);

// =============== Offer Management  ==========================//

adminRoute.get("/offers",offerController.loadOffers)

adminRoute.post("/addOffer",offerController.addOffer)
adminRoute.delete('/offers/:offerId', offerController.deleteOffer);


adminRoute.post("/addCategoryOffer",offerController.addCategoryOffer)


adminRoute.post("/editOffer",offerController.editOffer)

adminRoute.post("/editCategoryOffer",offerController.editCategoryOffer)



// =============== Coupon Management  ==========================//


adminRoute.get("/coupons",couponController.loadCoupons)
adminRoute.delete('/coupons/:couponId', couponController.deleteCoupon);


adminRoute.post("/addCoupon",couponController.addCoupon)

adminRoute.post("/editCoupon",couponController.editCoupon)


adminRoute.get("/salesReport",adminController.loadSalesReport)
adminRoute.post("/generateSalesReport",adminController.generateSalesReport)
adminRoute.post("/downloadSalesReport",adminController.downloadSalesReport)
 module.exports = adminRoute;