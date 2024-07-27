const {default : mongoose} = require("mongoose");

const dbConnect = async () => {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI);
      console.log("MongoDB Connected");
    } catch (err) {
      console.error("Error connecting to MongoDB:", err.message);
    }
  };
  
  
  module.exports = dbConnect;    