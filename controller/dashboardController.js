const Order = require("../models/orderModel");
const Product = require("../models/productSchema");
const User = require("../models/userModel");



const loadDashboard = async (req, res) => {
    try {
        const admin = req.session.admin;
        const users = await User.find();
      
        // Delivered, Returned, and Cancelled Counts (Same as before)
        const deliveredCount = await Order.aggregate([
            { $unwind: "$products" },
            { $match: { "products.status": { $in: ["Delivered", "Return Requested"] } } },
            { $count: "deliveredCount" }
        ]);

        const returnedCount = await Order.aggregate([
            { $unwind: "$products" },
            { $match: { "products.status": "Returned" } },
            { $count: "returnedCount" }
        ]);

        const cancelledCount = await Order.aggregate([
            { $unwind: "$products" },
            { $match: { "products.status": "Cancelled" } },
            { $count: "cancelledCount" }
        ]);

        const delivered = deliveredCount[0] ? deliveredCount[0].deliveredCount : 0;
        const returned = returnedCount[0] ? returnedCount[0].returnedCount : 0;
        const cancelled = cancelledCount[0] ? cancelledCount[0].cancelledCount : 0;

        const weeklyOrders = await Order.aggregate([
            { $unwind: "$products" },
            {
                $match: {
                    orderDate: {
                        $gte: new Date(new Date().setDate(new Date().getDate() - 7))
                    },
                    "products.status": { $in: ["Delivered"] }
                }
            },
            { $count: "weeklyCount" }
        ]);

        const monthlyOrders = await Order.aggregate([
            { $unwind: "$products" },
            {
                $match: {
                    orderDate: {
                        $gte: new Date(new Date().setMonth(new Date().getMonth() - 1))
                    },
                    "products.status": "Delivered"
                }
            },
            { $count: "monthlyCount" }
        ]);

        const yearlyOrders = await Order.aggregate([
            { $unwind: "$products" },
            {
                $match: {
                    orderDate: {
                        $gte: new Date(new Date().setFullYear(new Date().getFullYear() - 1))
                    },
                    "products.status": "Delivered"
                }
            },
            { $count: "yearlyCount" }
        ]);

        const weekly = weeklyOrders[0] ? weeklyOrders[0].weeklyCount : 0;
        const monthly = monthlyOrders[0] ? monthlyOrders[0].monthlyCount : 0;
        const yearly = yearlyOrders[0] ? yearlyOrders[0].yearlyCount : 0;

        const topProducts = await Order.aggregate([
            { $unwind: "$products" },
            { $group: { _id: "$products.productId", totalQuantity: { $sum: "$products.quantity" } }},
            { $sort: { totalQuantity: -1 }},
            { $limit: 10 },
            { $lookup: {
                from: "products",
                localField: "_id",
                foreignField: "_id",
                as: "productDetails"
            }},
            { $unwind: "$productDetails" },
            { $project: {
                _id: 0,
                productName: "$productDetails.name",
                totalQuantity: 1
            }}
        ]);

        // Top 10 Categories
        const topCategories = await Order.aggregate([
            { $unwind: "$products" },
            { $lookup: {
                from: "products",
                localField: "products.productId",
                foreignField: "_id",
                as: "productDetails"
            }},
            { $unwind: "$productDetails" },
            { $group: { _id: "$productDetails.category", totalQuantity: { $sum: "$products.quantity" } }},
            { $sort: { totalQuantity: -1 }},
            { $limit: 10 },
            { $lookup: {
                from: "categories",
                localField: "_id",
                foreignField: "_id",
                as: "categoryDetails"
            }},
            { $unwind: "$categoryDetails" },
            { $project: {
                _id: 0,
                categoryName: "$categoryDetails.name",
                totalQuantity: 1
            }}
        ]);

        res.render("adminDashboard", {
            admin,
            users,
            delivered,
            returned,
            cancelled,
            weekly,
            monthly,
            yearly,
            topProducts,
            topCategories,

        });
    } catch (err) {
        console.log("Error fetching admin dashboard", err);
        res.status(500).send("Internal server error");
    }
};



module.exports ={
    loadDashboard
}