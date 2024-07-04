const {default : mongoose} = require("mongoose");

const dbConnect = async () => {
    try {
      const conn = await mongoose.connect("mongodb://localhost:27017/Ecom");
      console.log("MongoDB Connected");
    } catch (err) {
      console.error("Error connecting to MongoDB:", err.message);
    }
  };
  
  
  module.exports = dbConnect;    