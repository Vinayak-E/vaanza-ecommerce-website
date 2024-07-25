const express = require("express");
const adminRoute = express();
const session = require("express-session");
const adminController = require("../controller/adminController");
const dashboardController = require("../controller/dashboardController");
const categoryController = require("../controller/categoryController");
const productController = require("../controller/productController");
const cartController = require('../controller/cartController')
const config = require("../config/config");
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
adminRoute.get("/", adminController.loadLogin);

adminRoute.post("/", adminController.verifyLogin);



adminRoute.get("/home",adminController.loadDashboard);
adminRoute.get("/logout",adminController.adminLogout);

// ===============User Management  ==========================//

adminRoute.get("/ums",adminController.loadUserMangment);
adminRoute.post("/blockUser", adminController.blockUser);



// =======    categotry managment   =======================//



adminRoute.get("/categories", categoryController.loadCategory);


adminRoute.get("/createCategory",categoryController.loadaAddCategory);

adminRoute.post("/categories", categoryController.insertCategory);



adminRoute.post("/list-unlist", categoryController.listUnlistCategory);

adminRoute.get("/edit-category",categoryController.editCategorypageLoad);

adminRoute.post("/edit-category", categoryController.editCategory);






// =======    Product managment   =======================//


adminRoute.get("/products", productController.loadProductList);


adminRoute.get("/addProduct", productController.loadAddproduct);

adminRoute.post( "/addproduct",multer.array("images"), productController.addProduct);

adminRoute.post('/listUnlistProduct', productController.listUnlistProduct);




adminRoute.post("/edit-product",productController.editProduct);

adminRoute.get("/loadVariant/:id", productController.loadVariant);


adminRoute.get("/addVariant", productController.loadAddVariant);


adminRoute.post("/addVariant",multer.array("images"), productController.addVariant);

adminRoute.get("/edit-variant",productController.loadEditVariant);

adminRoute.post("/edit-variant",multer.array('images', 4),productController.editVariant);





// ===============  Order Management  ==========================//

adminRoute.get("/orders",adminController.loadOrderlist)
adminRoute.get('/order-details/:orderId', adminController.orderDetails);

adminRoute.post('/update-status', adminController.updateOrderStatus);

 module.exports = adminRoute;