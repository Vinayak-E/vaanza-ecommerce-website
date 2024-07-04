const express = require("express");
const dbConnect = require("./config/dbConnect");
const app = express();
const dotenv = require("dotenv").config();
const PORT = process.env.PORT || 5000;
const path = require("path");
const nocache = require("nocache");
app.use(nocache());
app.use("/static", express.static(path.join(__dirname, "public/assets")));
app.use("/assets",express.static(path.join(__dirname, "public/assets/images")));

// Connect to MongoDB
dbConnect();

// for passing messages
const flash = require('express-flash');
const session = require('express-session');

app.use(session({
  secret: 'sessionscret',
  resave: false,
  saveUninitialized: true,
}));
app.use(flash())

 
// Middleware for parsing request bodies
app.use(express.urlencoded({ extended: true }));
 
// Routes
const userRoute = require("./routes/userRoute");
const adminRoute = require("./routes/adminRoute");

app.use("/", userRoute) ;
app.use("/admin",adminRoute);
 
// Start server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}/`);
});
     