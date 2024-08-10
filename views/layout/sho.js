const User = require("../model/usersModel");
const Product = require("../model/productsModel");
const Brand = require("../model/brandsModel");
const Category = require("../model/categoriesModel");
const Address = require("../model/addressesModel");
const Cart = require("../model/cartModel");
const Payment = require("../model/paymentModel");
const Order = require("../model/ordersModel");
const Coupon = require("../model/couponsModel");
const Offer = require("../model/offersModel");
const Wishlist = require("../model/wishlistModel");
const Wallet = require("../model/walletsModel");
const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const sendEmail = require("../model/sendEmail");
const sendForgotEmail = require("../model/sendForgotEmail");
const generateOtp = require("../model/generateOtp");
require('dotenv').config();
const Razorpay = require('razorpay');

const razorpay = new Razorpay({
    key_id: process.env.KEY_ID,
    key_secret: process.env.KEY_SECRET
});

const userHome = async (req, res) => {
    try {
        const user = req.session.user;
        const products = await Product.find({ isListed: true })
            .populate({
                path: 'category',
                match: { isListed: true }
            })
            .populate({
                path: 'brand',
                match: { isListed: true }
            });

        const filteredProducts = products.filter(product => product.category && product.brand);
        const newArrivals = await Product.find().sort({ addedDate: -1 }).limit(10);
        const mostPurchased = await Order.aggregate([
            { $unwind: '$products' },
            { $group: { _id: '$products.product', count: { $sum: '$products.quantity' } } },
            { $sort: { count: -1 } },
            { $limit: 5 }
        ]);
        const mostPurchasedProducts = await Product.find({ 
            _id: { $in: mostPurchased.map(item => item._id) }
        });

        const categories = await Category.find({});
        const menCategory = await Category.findOne({ name: 'Men' });
        const womenCategory = await Category.findOne({ name: 'Women' });
        const mostPurchasedMen = await Product.find({ 
            _id: { $in: mostPurchased.map(item => item._id) },
            category: menCategory._id
        });
        const mostPurchasedWomen = await Product.find({ 
            _id: { $in: mostPurchased.map(item => item._id) },
            category: womenCategory._id
        });

        if (!user) {
            res.render('home' , {
                products: filteredProducts,
                newArrivals,
                mostPurchasedProducts,
                mostPurchasedMen,
                mostPurchasedWomen,
                categories
            });
        }
        else {

            const cart = await Cart.findOne({user: user._id}).populate('products.product');
            let subtotal = 0;

            if (cart) {
                subtotal = cart.products.reduce((sum, item) => {
                return sum + (item.product.price * item.quantity);
                }, 0);
            }
            
            res.render('home', {
                user,
                products: filteredProducts,
                cart,
                subtotal,
                newArrivals,
                mostPurchasedProducts,
                mostPurchasedMen,
                mostPurchasedWomen,
                categories
            });
        }
    } catch (err) {
        console.error(err, "Error rendering home");
    }
}

const userLogin = (req, res) => {
    if (req.session.user) {
        res.redirect("/");
    }
    else {
        successMsg = req.query.successMsg;
        res.render("login", {successMsg});
    }
}

const verifyLogin = async (req, res) => {
    
    try {
        const { email, password} = req.body;
        const user = await User.findOne({email: email, isBlocked: false});

        if(!user) {
            res.status(200).json({ message: "*Invalid email or password!"});
        }
        else {
            const comparePass = await bcrypt.compare(password, user.password);
            
            if(!comparePass) {
                res.status(200).json({ message: "*Invalid email or password!"});
                return;
            }
            req.session.user = user;
            res.status(200).json({success: true});
        }
    }
    catch(err) {
        console.error("Error logging in", err);
        res.status(500).send("Internal server error");
    }
}

const signup = (req, res) => {
    let formData = req.session.signupData || {};
    console.log(formData);
    res.render("signup", {formData});
}

const verifySignup = async (req, res) => {

    try {
        const {fname, lname, age, phone, email, password} = req.body;

        const existingEmail = await User.findOne({email});
        const existingPhone = await User.findOne({phone});

        if(existingEmail) {
            res.render("signup", {signupMessage: "Email is already registered!", formData: {fname, lname, age, phone, email}});
            return;
        }
        else if(existingPhone) {
            res.render("signup", {signupMessage: "Phone number is already registered!", formData: {fname, lname, age, phone, email}});
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const { otp, createdAt} = generateOtp();
        console.log(otp);

        req.session.signupData = { fname, lname, age, phone, email, password: hashedPassword, otp, createdAt };
        await sendEmail(email, otp);

        res.redirect("/verifyOtp");
        
    }
    catch(err) {
        console.error("Error registering user", err);
        res.status(500).send("Error registering user");
    }
}

const resendOtp = async (req, res) => {
    try {
        const {signupData} = req.session;

        if(!signupData) {
            console.log("Session expired or invalid!");
            return;
        }

        const { otp, createdAt } = generateOtp();
        signupData.otp = otp;
        signupData.createdAt = createdAt;

        await sendEmail(signupData.email, otp);
        res.render("signupOtp");
        console.log("Otp sent successfully!");
        console.log(otp)

    } catch (err) {
        console.log("Error resending the otp",err);
    }
}

const getVerifyOtp = (req, res) => {
    const signupData = req.session.signupData;
    if(!signupData) {
        res.render("signup", {signupMessage: "Session has expired. Please try again!"});
        return;
    }
    const {email} = signupData;
    res.render("signupOtp", {otpEmailData: email});
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const signupData = req.session.signupData;

        if (!signupData) {
            res.render("signup", {signupMessage: "Session has expired. Please try again!"});
        }
        else if (!otp) {
            return res.render("signupOtp", {errMsg: "PLease enter the OTP"});
        }

        const {createdAt} = signupData;
        const currTime = Date.now();
        const timeDifference = (currTime - createdAt) / 1000;
        console.log(timeDifference);

        if(timeDifference > 30){
            return res.render("signupOtp", {errMsg: "OTP expired!"});
        }

        if(signupData.otp === otp) {
            const newUser = new User ({
                fname: signupData.fname,
                lname: signupData.lname,
                age: signupData.age,
                phone: signupData.phone,
                email: signupData.email,
                password: signupData.password,
            });

            await newUser.save();
            req.session.signupData = null;
            // res.redirect("/userLogin?registerMsg=Registered Successfully...");
            // res.json({success: true});
            console.log("OTP Matched!");
            res.redirect("/userLogin?successMsg=Registration successful...");
        }
        else {
            // res.json({success: false});
            // res.render("signupOtp", {errorMsg: "Invalid OTP!"})
            console.log("OTP does not Match!");
            res.render("signupOtp", {errMsg: "Invalid OTP"});
        }

    } catch(err) {
        // res.json({success: false})
        console.log("Error verifying OTP", err);
    }
}

const userLogout = (req, res) => {
    delete req.session.user;
    res.redirect("/");
}

const isNewProduct = (addedDate) => {
    const currentDate = new Date();
    const twoDaysAgo = new Date(currentDate);
    twoDaysAgo.setDate(currentDate.getDate() - 2);
    return addedDate >= twoDaysAgo;
};

//Best offer function
const getBestOffer = (product, offers) => {
    if (!product.offers || product.offers.length === 0) {
        return null;
    }

    const relevantOffers = offers.filter(offer => product.offers.includes(offer._id));

    const productOffers = relevantOffers.filter(offer => offer.type === 'products' && offer.isActive);
    const categoryOffers = relevantOffers.filter(offer => offer.type === 'categories' && offer.isActive);

    const allActiveOffers = [...productOffers, ...categoryOffers];

    const bestOffer = allActiveOffers.reduce((maxOffer, offer) => offer.discount > maxOffer.discount ? offer : maxOffer, { discount: 0 });

    return bestOffer.discount > 0 ? bestOffer : null;
};

const toshop = async (req, res) => {
    try {
        const sortBy = req.query.sortby || 'featured';
        const searchVal = req.query.searchVal || '';
        const user = req.session.user;
        const offers = await Offer.find().populate('item');

        // Get listed categories and brands
        const listedCategories = await Category.find({ isListed: true }).select('_id');
        const listedBrands = await Brand.find({ isListed: true }).select('_id');
        const filterCategories = req.query.filterCategories ? [].concat(req.query.filterCategories) : [];
        const filterBrands = req.query.filterBrands ? [].concat(req.query.filterBrands) : [];
        const filter = { isListed: true };

        // Add listedCategories to filterCategories
        const categoryFilter = filterCategories.length > 0
            ? { $in: filterCategories.filter(cat => listedCategories.map(lc => lc._id.toString()).includes(cat)) }
            : { $in: listedCategories.map(cat => cat._id) };

        // Add listedBrands to filterBrands
        const brandFilter = filterBrands.length > 0
            ? { $in: filterBrands.filter(brand => listedBrands.map(lb => lb._id.toString()).includes(brand)) }
            : { $in: listedBrands.map(brand => brand._id) };

        // Update filter object
        if (categoryFilter.$in.length > 0) {
            filter.category = categoryFilter;
        }

        if (brandFilter.$in.length > 0) {
            filter.brand = brandFilter;
        }

        if (searchVal) {
            filter.description = { $regex: searchVal, $options: 'i' };
        }

        const brands = await Brand.find({ isListed: true });
        const categories = await Category.find({});

        // Pagination
        const page = parseInt(req.query.page, 10) || 1;
        const limit = 9;
        const skip = (page - 1) * limit;

        const totalProductsCount = await Product.countDocuments(filter);
        const totalPages = Math.ceil(totalProductsCount / limit);

        let products;

        // Fetch products based on sortBy
        const collation = { locale: 'en', strength: 2 };

        if (sortBy === 'newArrivals') {
            products = await Product.find(filter)
                .sort({ addedDate: -1 })
                .populate('category')
                .populate('brand')
                .skip(skip)
                .limit(limit);
        } else if (sortBy === 'popularity') {
            const popular = await Order.aggregate([
                { $unwind: '$products' },
                { $group: { _id: '$products.product', count: { $sum: '$products.quantity' } } },
                { $sort: { count: -1 } }
            ]);
            const popularProductIds = popular.map(item => item._id);

            const popularProducts = await Product.find({
                ...filter,
                _id: { $in: popularProductIds }
            })
                .populate('category')
                .populate('brand')
                .limit(limit);

            const otherProducts = await Product.find({
                ...filter,
                _id: { $nin: popularProductIds }
            })
                .populate('category')
                .populate('brand')
                .limit(limit);

            products = [...popularProducts, ...otherProducts].slice(0, limit);
        } else if (sortBy === 'highToLow') {
            products = await Product.find(filter)
                .sort({ price: -1 })
                .populate('category')
                .populate('brand')
                .skip(skip)
                .limit(limit);
        } else if (sortBy === 'lowToHigh') {
            products = await Product.find(filter)
                .sort({ price: 1 })
                .populate('category')
                .populate('brand')
                .skip(skip)
                .limit(limit);
        } else if (sortBy === 'ascending') {
            products = await Product.find(filter)
                .collation(collation)
                .sort({ name: 1 })
                .populate('category')
                .populate('brand')
                .skip(skip)
                .limit(limit);
        } else if (sortBy === 'descending') {
            products = await Product.find(filter)
                .collation(collation)
                .sort({ name: -1 })
                .populate('category')
                .populate('brand')
                .skip(skip)
                .limit(limit);
        } else {
            products = await Product.find(filter)
                .populate('category')
                .populate('brand')
                .skip(skip)
                .limit(limit);
        }

        // Assign best offer to each product
        products.forEach(product => {
            product.bestOffer = getBestOffer(product, offers);
        });

        // Render the shop page
        if (!user) {
            res.render('shop', {
                products,
                categories,
                sortBy,
                currentPage: page,
                totalPages,
                totalProductsCount,
                brands,
                isNewProduct,
                filterCategories,
                filterBrands,
                searchVal
            });
        } else {
            const cart = await Cart.findOne({ user: user._id }).populate('products.product');
            let subtotal = 0;

            if (cart) {
                subtotal = cart.products.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
            }
            res.render('shop', {
                user,
                products,
                cart,
                subtotal,
                categories,
                sortBy,
                currentPage: page,
                totalPages,
                totalProductsCount,
                brands,
                isNewProduct,
                filterCategories,
                filterBrands,
                searchVal
            });
        }
    } catch (err) {
        console.error(err, "Error rendering shop");
    }
}

const toProdDetails = async (req, res) => {
    try {
        const user = req.session.user;
        const product = await Product.findOne({_id: req.params.product_id})
            .populate('category')
            .populate('offers');

        const categoryOffers = await Offer.find({ type: 'categories', item: product.category, isActive: true });
        const productOffers = await Offer.find({ type: 'products', item: product._id, isActive: true });
        

        const allActiveOffers = [...productOffers, ...categoryOffers];
        const bestOffer = allActiveOffers.reduce((maxOffer, offer) => offer.discount > maxOffer.discount ? offer : maxOffer, { discount: 0 });

        product.bestOffer = bestOffer.discount > 0 ? bestOffer : null;

        const category = product.category;
        const recomProducts = await Product.find({ category, _id: { $ne: req.params.product_id } });

        let subtotal = 0;

        if (!user) {
            res.render('prodDetails', { 
                user: false,
                product, 
                recomProducts,
                subtotal,
                isNewProduct,
            });
            return;
        }

        const cart = await Cart.findOne({ user: user._id }).populate('products.product');

        if (cart) {
            subtotal = cart.products.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        }

        res.render('prodDetails', { 
            user,
            cart,
            product, 
            recomProducts,
            subtotal,
            isNewProduct,
        });
    } catch (err) {
        console.error(err, "Error rendering product details");
    }
}

const toUserProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        res.render('userProfile', {user, userId});
    }
    catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).send('Internal server error');
    }
}

const toEditProfile = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        res.render('userEditProfile', {user, userId});
    }
    catch (err) {
        console.error('Error fetching user profile:', err);
        res.status(500).send('Internal server error');
    }
}

const editProfile = async (req, res) => {
    try {
        const { fname, lname, age, phone, email } = req.body;
        console.log(email)
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(200).json({ message: 'User not found' });
        }
        else if (fname === user.fname && lname === user.lname && age === user.age && phone === user.phone && email === user.email) {
            res.status(200).json({ message: 'No changes to save' });
        }

        if (email) {
            if (typeof email !== 'string' || !email.trim()) {
                return res.status(400).json({ message: 'Invalid email format' });
            }
            const existingUser = await User.findOne({ email, _id: { $ne: userId } });
            if (existingUser) {
                return res.status(409).json({ message: 'A user with this email already exists!' });
            }
        }

        const updates = {};
        if (fname && fname !== user.fname) updates.fname = fname;
        if (lname && lname !== user.lname) updates.lname = lname;
        if (age && age !== user.age) updates.age = age;
        if (phone && phone !== user.phone) updates.phone = phone;
        if (email && email !== user.email) updates.email = email;

        await User.findByIdAndUpdate(userId, {$set: updates});
        res.status(200).json({success: true});
    }
    catch (err) {
        console.error('Error editing user profile:', err);
        res.status(500).send('Internal server error');
    }
}

const toChangePass = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        res.render('userChangePassword', { user, userId });
    }
    catch (err) {
        console.error('Error fetching userChangePassword', err);
        res.status(500).send('Internal server error');
    }
}

const verifyChangePass = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { password, newPassword } = req.body;
        const user = await User.findOne({ _id: userId });
        const comparePass = await bcrypt.compare(password, user.password);

        if (!comparePass) {
            res.status(200).json({ message: 'Invalid current password!'});
            return;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        user.password = hashedPassword;
        await user.save();

        res.status(200).json({success: true});
        
    }
    catch (err) {
        console.error('Error changing the password', err);
        res.status(500).send('Internal server error');
    }
}

const toAddr = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        const addresses = await Address.find({user: userId});
        console.log(addresses);
        res.render('userAddresses', {user, userId, addresses});
    }
    catch (err) {
        console.error('Error fetching addresses', err);
        res.status(500).send('Internal server error'); 
    }
}

const toAddAddr = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        res.render('userAddAddress', {user, userId});
    }
    catch (err) {
        console.error('Error fetching add address', err);
        res.status(500).send('Internal server error'); 
    }
}

const verifyAddAddr = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { fname, lname, country, city, state, pincode, phone } = req.body;

        const newAddress = new Address ({
            fname,
            lname,
            country,
            city,
            state,
            pincode,
            phone,
            user: userId
        })

        await newAddress.save();

        res.status(200).json({success: true});
        
    }
    catch (err) {
        console.error('Error adding the address', err);
        res.status(500).send('Internal server error');
    }
}

const deleteAddress = async (req, res) => {
    try {
        const addressId = req.params.address_id;
        await Address.findByIdAndDelete(addressId);
        res.status(200).json({success: true});
    }
    catch (err) {
        console.error('Error deleting address', err);
        res.status(500).send('Internal server error');
    }
}

const toEditAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const addressId = req.params.address_id;
        const address = await Address.findById(addressId);
        const user = await User.findById(userId);
        res.render('userEditAddress', {user, userId, address});
    }
    catch (err) {
        console.error('Error fetching edit address', err);
        res.status(500).send('Internal server error'); 
    }
}

const verifyEditAddress = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const addressId = req.params.address_id;
        const { fname, lname, country, city, state, pincode, phone } = req.body;

        await Address.findByIdAndUpdate(addressId, {fname, lname, country, city, state, pincode, phone, user: userId});

        res.status(200).json({success: true});
        
    }
    catch (err) {
        console.error('Error editing the address', err);
        res.status(500).send('Internal server error');
    }
}

const toCart = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        const cart = await Cart.findOne({ user: userId }).populate('products.product');

        if (cart) {
            const productIds = cart.products.map(item => item.product._id);
            const products = await Product.find({ _id: { $in: productIds } }).populate('offers');
            const categories = await Category.find({ _id: { $in: products.map(p => p.category) } });
            const offers = await Offer.find({ 
                $or: [
                    { item: { $in: productIds } },
                    { item: { $in: categories.map(c => c._id) } }
                ],
                isActive: true
            });

            let realSubtotal = 0;
            let discountTotal = 0;
            let subtotal = 0;

            cart.products = cart.products.map(item => {
                const product = products.find(p => p._id.equals(item.product._id));
                const productOffers = offers.filter(o => o.item.includes(product._id));
                const categoryOffers = offers.filter(o => o.item.includes(product.category));
                const allOffers = [...productOffers, ...categoryOffers];
                const bestOffer = allOffers.reduce((best, offer) => 
                    offer.discount > best.discount ? offer : best, { discount: 0 });

                const originalPrice = product.price;
                const discountedPrice = originalPrice * (1 - bestOffer.discount / 100);
                const itemTotal = discountedPrice * item.quantity;

                realSubtotal += originalPrice * item.quantity;
                discountTotal += (originalPrice - discountedPrice) * item.quantity;
                subtotal += itemTotal;

                return {
                    ...item.toObject(),
                    originalPrice,
                    discountedPrice,
                    bestOffer,
                    itemTotal
                };
            });

            // const gst = subtotal * 0.18;
            const shipping = subtotal < 500 ? 40 : 0;
            const total = subtotal + shipping;

            res.render('cart', {
                user,
                userId,
                cart,
                realSubtotal,
                discountTotal,
                subtotal,
                // gst,
                shipping,
                total
            });
        } else {
            res.render('cart', { 
                user, 
                userId, 
                cart, 
                realSubtotal: 0, 
                discountTotal: 0, 
                subtotal: 0, 
                // gst: 0, 
                shipping: 0, 
                total: 0 
            });
        }
    } catch (err) {
        console.error('Error fetching cart', err);
        res.status(500).send('Internal server error');
    }
}

const addToCart = async (req, res) => {
    try {
        console.log('Request received:', req.body);
        const user = req.session.user;
        const { productId, quantity } = req.body;

        if (!user || user.isBlocked) {
            return res.status(200).json({ user: false });
        }

        const userId = user._id;

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, products: [] });
        }

        const productIndex = cart.products.findIndex(p => p.product.toString() === productId);

        if (productIndex > -1) {
            return res.status(200).json({ message: 'Already added to cart!', user: true });
        } else {
            cart.products.push({ product: productId, quantity: parseInt(quantity, 10) || 1 });
            await cart.save();
            return res.status(200).json({ success: true, user: true });
        }
    } catch (err) {
        console.error('Error adding product to cart:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
};

const deleteCartItem = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.params.product_id;
        const cart = await Cart.findOne({user: userId});
        
        if (cart) {
            cart.products = cart.products.filter(item => item.product.toString() !== productId);
            await cart.save();
            console.log('Product removed from cart:', cart);
            return res.status(200).json({ success: true });
        } else {
            return res.status(404).json({ message: 'Cart not found' });
        }
    }
    catch (err) {
        console.error('Error deleting cart item', err);
        res.status(500).send('Internal server error'); 
    }
}


const updateCart = async (req, res) => {
    try {
        const { productId, quantity } = req.body;
        const userId = req.session.user._id;
        
        const cart = await Cart.findOne({ user: userId }).populate('products.product');

        if (cart) {
            const productIndex = cart.products.findIndex(item => item.product._id.toString() === productId);
            if (productIndex > -1) {
                cart.products[productIndex].quantity = quantity;
                await cart.save();

                // Recalculate discounts
                const product = cart.products[productIndex].product;
                const offers = await Offer.find({
                    $or: [
                        { item: product._id },
                        { item: product.category }
                    ],
                    isActive: true
                });

                const bestOffer = offers.reduce((best, offer) => 
                    offer.discount > best.discount ? offer : best, { discount: 0 });

                const originalPrice = product.price;
                const discountedPrice = originalPrice * (1 - bestOffer.discount / 100);
                const itemTotal = discountedPrice * quantity;

                return res.json({ 
                    success: true,
                    updatedItem: {
                        productId,
                        originalPrice,
                        discountedPrice,
                        quantity,
                        itemTotal
                    }
                });
            } else {
                return res.status(404).json({ message: 'Product not found in cart' });
            }
        } else {
            return res.status(404).json({ message: 'Cart not found' });
        }
    } catch (err) {
        console.error('Error updating cart', err);
        res.status(500).send('Internal server error');
    }
}

const toCheckout = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'products.product',
            populate: {
                path: 'offers',
                match: { isActive: true }
            }
        });
        const addresses = await Address.find({ user: userId });
        const coupons = await Coupon.find({});
        let paymentMethod = await Payment.find({ user: userId });

        if (paymentMethod.length === 0) {
            const newMethod = new Payment({
                user: user._id,
                type: 'Cash on delivery',
                details: null
            });
            await newMethod.save();
        }

        paymentMethod = await Payment.find({ user: userId });

        if (cart) {
            let subtotal = 0;
            let totalOfferDiscount = 0;

            // Calculate subtotal and total offer discount
            for (const item of cart.products) {
                const productPrice = item.product.price || 0;
                const quantity = item.quantity || 0;
                let discountedPrice = productPrice;
                let bestOfferDiscount = 0;

                // Fetch product and category offers
                const productOffers = item.product.offers || [];
                const categoryOffers = await Offer.find({
                    item: item.product.category,
                    isActive: true
                });

                // Combine all offers
                const allOffers = [...productOffers, ...categoryOffers];

                // Determine the best offer
                for (const offer of allOffers) {
                    if (offer.isActive) {
                        const offerDiscount = (discountedPrice * offer.discount) / 100;
                        if (offerDiscount > bestOfferDiscount) {
                            bestOfferDiscount = offerDiscount;
                        }
                    }
                }

                discountedPrice -= bestOfferDiscount;
                const offerDiscount = (productPrice - discountedPrice) * quantity;
                subtotal += discountedPrice * quantity;
                totalOfferDiscount += offerDiscount;
            }

            const gst = subtotal * 0.18;
            const shipping = subtotal < 500 ? 40 : 0;
            const total = subtotal + gst + shipping;

            res.render('checkout', {
                user,
                userId,
                cart,
                total,
                gst,
                shipping,
                coupons,
                addresses,
                paymentMethod,
                subtotal,  // Pass subtotal to the template
                totalOfferDiscount,  // Pass totalOfferDiscount to the template
                totalAmount: total  // Pass totalAmount to the template
            });
        } else {
            res.render('checkout', {
                user,
                userId,
                cart,
                subtotal: 0,
                addresses,
                paymentMethod,
                totalOfferDiscount: 0,
                totalAmount: 0  // Default totalAmount to 0 when cart is empty
            });
        }
    } catch (err) {
        console.error('Error fetching checkout', err);
        res.status(500).send('Internal server error');
    }
};

const generateOrderId = () => {
    const date = new Date();
    const components = [
        date.getFullYear(),
        ('0' + (date.getMonth() + 1)).slice(-2),
        ('0' + date.getDate()).slice(-2),
        ('0' + date.getHours()).slice(-2),
        ('0' + date.getMinutes()).slice(-2),
        ('0' + date.getSeconds()).slice(-2),
    ];

    const dateString = components.join('');
    const randomNumber = Math.floor(Math.random() * 10000);

    return `ORD-${dateString}-${randomNumber}`;
};

const updateProductQuantities = async (orderId) => {
    try {
        const order = await Order.findById(orderId).populate('products.product');

        if (!order) {
            throw new Error('Order not found');
        }

        for (const item of order.products) {
            const productId = item.product._id;
            const orderedQuantity = item.quantity;

            const product = await Product.findById(productId);

            if (product) {
                console.log(product.name);
                console.log(product.stock);
                product.stock -= orderedQuantity;
                console.log(product.stock);
                if (product.stock < 0) {
                    product.stock = 0;
                }

                await product.save();
            }
        }

        console.log('Product quantities updated successfully');
    } catch (err) {
        console.error('Error updating product quantities:', err);
    }
}

const createOrder = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const { addressId, paymentMethodId, couponCode } = req.body;
        
        const paymentMethod = await Payment.findById(paymentMethodId);
        const user = await User.findById(userId);
        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'products.product',
            populate: {
                path: 'offers'
            }
        });
        const orderId = generateOrderId();
        const address = await Address.findById(addressId);

        if (!cart) {
            return res.json({ message: 'Cart is empty' });
        }

        const orderProducts = [];
        const appliedOffers = new Set();
        let subtotal = 0;
        let totalDiscountAmount = 0;

        for (const item of cart.products) {
            const product = item.product;
            const quantity = item.quantity;
            const productPrice = product.price || 0;

            let discountedPrice = productPrice;
            let bestOfferDiscount = 0;
            let bestOfferId = null;

            const productOffers = product.offers || [];
            const categoryOffers = await Offer.find({
                item: product.category,
                isActive: true
            });

            const allOffers = [...productOffers, ...categoryOffers];

            for (const offer of allOffers) {
                if (offer.isActive) {
                    const offerDiscount = (discountedPrice * offer.discount) / 100;
                    if (offerDiscount > bestOfferDiscount) {
                        bestOfferDiscount = offerDiscount;
                        bestOfferId = offer._id;
                    }
                }
            }

            discountedPrice -= bestOfferDiscount;
            orderProducts.push({
                product: product._id,
                quantity,
                price: discountedPrice,
                status: 'pending',
                cancellationDate: null,
                cancellationReason: null,
                returnDate: null,
                returnReason: null
            });

            subtotal += discountedPrice * quantity;

            if (bestOfferId) {
                appliedOffers.add(bestOfferId);
                totalDiscountAmount += bestOfferDiscount * quantity;
            }
        }

        let couponDiscount = 0;
        let coupon = null;

        if (couponCode) {
            const couponDoc = await Coupon.findOne({ code: couponCode });
            if (couponDoc) {
                coupon = {
                    code: couponDoc.code,
                    discount: couponDoc.discount,
                    description: couponDoc.description,
                    minPurchase: couponDoc.minPurchase,
                    maxAmount: couponDoc.maxAmount,
                    validity: couponDoc.validity
                };
                couponDiscount = subtotal * coupon.discount / 100;
            }
        }

        const gst = subtotal * 0.18;
        subtotal -= couponDiscount;
        const shipping = subtotal < 500 ? 40 : 0;
        let totalAmount = subtotal + gst + shipping;

        const newOrder = new Order({
            orderId: orderId,
            user: user._id,
            address: {
                fname: address.fname,
                lname: address.lname,
                city: address.city,
                state: address.state,
                country: address.country,
                pincode: address.pincode,
                phone: address.phone
            },
            orderDate: new Date(),
            coupon,
            products: orderProducts,
            payment: paymentMethodId,
            offers: Array.from(appliedOffers),
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            gst: parseFloat(gst.toFixed(2)),
            shipping: parseFloat(shipping.toFixed(2)),
            totalDiscountAmount: parseFloat(totalDiscountAmount.toFixed(2))
        });

        await newOrder.save();
        const createdOrder = await Order.findOne({ orderId });

        if (paymentMethod.type === 'Razorpay') {
            const razorpayOrder = await razorpay.orders.create({
                amount: parseInt(totalAmount * 100),
                currency: 'INR',
                receipt: orderId,
                payment_capture: 1
            });

            await Cart.deleteOne({ user: userId });

            return res.status(200).json({
                success: true,
                totalAmount: parseInt(totalAmount * 100),
                paymentMethod: paymentMethod.type,
                orderId: orderId,
                totalDiscountAmount,
                razorpayOrderId: razorpayOrder.id,
                key: process.env.KEY_ID,
                user: {
                    name: user.fname,
                    email: user.email,
                    phone: user.phone
                }
            });
        }

        await Cart.deleteOne({ user: userId });
        updateProductQuantities(createdOrder._id);

        res.status(200).json({ success: 'Order placed successfully', orderId, totalDiscountAmount });
    } catch (err) {
        console.error('Error creating order', err);
        res.status(500).send('Internal server error');
    }
};

const toOrderConf = async (req, res) => {
    try {
        const user = req.session.user;
        const orderId = req.params.order_id;
        const offerDiscount = req.query.discount;
        const order = await Order.findOne({ orderId })
            .populate('products.product');

            console.log('Order: ', order);
            

        const orderDate = new Date(order.orderDate);
        const expectedDeliveryDate = new Date(orderDate);
        expectedDeliveryDate.setDate(orderDate.getDate() + 3);

        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const deliveryDay = days[expectedDeliveryDate.getDay()];

        const subtotal = order.products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const gst = subtotal * 0.18;
        const shippingCharge = subtotal < 500 ? 40 : 0;
        let totalAmount = subtotal + gst + shippingCharge;
        let couponDiscount = 0;
        if (order.coupon !== null) {
            couponDiscount = subtotal * order.coupon.discount / 100;
        }
        const subtotalBefore = order.products.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

        console.log(offerDiscount, couponDiscount);
        

        const discount1 = parseFloat(offerDiscount);
        const discount2 = isNaN(couponDiscount) ? 0 : parseFloat(couponDiscount);
        const totalDiscount = discount1 + discount2;

        totalAmount -= discount2;

        res.render('orderConfirmation', { user, order, deliveryDay, subtotal, subtotalBefore, gst, shippingCharge, totalAmount, totalDiscount });
    } catch (err) {
        console.error('Error fetching order confirmation', err);
        res.status(500).send('Internal server error'); 
    }
};

const toOrderHistory = async (req, res) => {
    try {
        const user = req.session.user;
        const orders = await Order.find({ user: user._id }).sort({ orderDate: -1 });

        res.render('orderHistory', { user, orders });
    }
    catch (err) {
        console.error('Error fetching order History', err);
        res.status(500).send('Internal server error'); 
    }
}

const toOrderDetails = async (req, res) => {
    try {
        const user = req.session.user;
        const orderId = req.params.order_id;
        const order = await Order.findById(orderId).populate('products.product');

        if (!order || order.user.toString() !== user._id.toString()) {
            return res.status(404).send('Order not found');
        }

        const subtotal = order.products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const gst = subtotal * 0.18;
        const subtotalBefore = order.products.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        const shipping = subtotal < 500 ? 40 : 0;
        const totalAmount = order.totalAmount;
        const offerDiscount = subtotalBefore - subtotal;
        const couponDiscount = subtotal * order.coupon.discount / 100;
        const totalDiscount = offerDiscount + couponDiscount;

        res.render('orderDetails', { user, order, subtotalBefore, totalDiscount , gst, shipping, totalAmount });
    } catch (err) {
        console.error('Error fetching order details', err);
        res.status(500).send('Internal server error');
    }
};

const cancelProduct = async (req, res) => {

        const { orderId, productId } = req.params;
        const reason = req.body.reason;
        const user = req.session.user;

    try {
        const order = await Order.findById(orderId);
        console.log(order.address);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        const product = order.products.find(item => item.product.toString() === productId);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found in order' });
        }

        product.status = 'cancelled';
        product.cancellationDate = Date.now();
        product.cancellationReason = reason;

        const productPurchasePrice = product.price;

        let wallet  = await Wallet.findOne({ user: user._id });

        if (!wallet) {
            const newWallet = new Wallet({
                user: user._id,
                balance: 0,
                transactions: []
            });

            await newWallet.save();

            wallet = await Wallet.findOne({ user: user._id });
        }

        wallet.balance += productPurchasePrice;

        await wallet.save();

        const updateProduct = await Product.findOne({ _id: productId });

        updateProduct.stock += product.quantity;

        await updateProduct.save();
        await order.save();
        res.json({ success: true });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const returnProduct = async (req, res) => {
    

    const { orderId, productId } = req.params;
    const reason = req.body.reason;

try {
    const order = await Order.findById(orderId);
    console.log(order.address);
    if (!order) {
        return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const product = order.products.find(item => item.product.toString() === productId);
    if (!product) {
        return res.status(404).json({ success: false, message: 'Product not found in order' });
    }

    product.status = 'return requested';
    product.returnReason = reason;

    const updateProduct = await Product.findOne({ _id: productId });

    updateProduct.stock += product.quantity;

    await updateProduct.save();
    await order.save();
    res.json({ success: true });

} catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
}
};

const forgotPass = async (req, res) => {
    try {
        const message = req.query.message;
        res.render('forgotPass', { message });
    } catch (err) {
        console.error('Error fetching forgot passwword: ', err);
        res.status(500).send('Internal server error');
    }
}

const verifyForgotPass = async (req, res) => {
    try {
        const email = req.body.email;
        const user = await User.findOne({ email: email })

        if (!user) {
            res.json({ success: false });
            console.log('Email is not registered!');
            return;
        }

        sendForgotEmail(email);
        console.log('Successfully sent!');
        res.json({ success: true });

    } catch (err) {
        console.error('Error sending link to the mail: ', err);
        res.status(500).send('Internal server error');
    }
}

const resetForgotPass = async (req, res) => {
    try {
        const token = req.query.token;
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const email = decoded.email;
        const user = await User.findOne({ email: email })

        if (!user) {
            res.json({ success: false });
            return;
        }

        res.render('resetForgotPass', { email });



    } catch (err) {
        console.error('Error sending link to the mail: ', err);
        res.status(500).send('Internal server error');
    }
}

const verifyResetPass = async (req, res) => {
    try {
        const { pass, email } = req.body;
        const user = await User.findOne({ email: email })

        if (!user) {
            res.json({ success: false });
            console.log('Reset Email is not registered!');
            return;
        }

        const hashedPass = await bcrypt.hash(pass, 10);

        user.password = hashedPass;
        await user.save();

        console.log('Password successfully updated!');
        res.json({ success: true });

    } catch (err) {
        console.error('Error reseting the password: ', err);
        res.status(500).send('Internal server error');
    }
}

const applyCoupon = async (req, res) => {
    try {
        const code = req.params.couponCode;
        const user = req.session.user;
        const cart = await Cart.findOne({ user: user._id }).populate({
            path: 'products.product',
            populate: {
                path: 'offers',
                match: { isActive: true }
            }
        });
        const coupon = await Coupon.findOne({ code: code });

        const usedCoupon = await Order.findOne({
            user: user._id,
            'coupon.code': code
        });

        if (usedCoupon) {
            return res.status(400).json({ success: false, message: "You have already used this coupon." });
        }

        if (!coupon) {
            res.json({ success: false, message: 'The coupon is not valid!' });
            return;
        }

        if (!cart) {
            res.json({ success: false, message: 'The cart is empty!' });
            return;
        }

        let subtotal = 0;
        let totalOfferDiscount = 0;

        // Calculate subtotal after applying offers
        for (const item of cart.products) {
            const productPrice = item.product.price || 0;
            const quantity = item.quantity || 0;
            let discountedPrice = productPrice;
            let bestOfferDiscount = 0;

            // Fetch product and category offers
            const productOffers = item.product.offers || [];
            const categoryOffers = await Offer.find({
                item: item.product.category,
                isActive: true
            });

            // Combine all offers
            const allOffers = [...productOffers, ...categoryOffers];

            // Determine the best offer
            for (const offer of allOffers) {
                if (offer.isActive) {
                    const offerDiscount = (discountedPrice * offer.discount) / 100;
                    if (offerDiscount > bestOfferDiscount) {
                        bestOfferDiscount = offerDiscount;
                    }
                }
            }

            discountedPrice -= bestOfferDiscount;
            const offerDiscount = (productPrice - discountedPrice) * quantity;
            subtotal += discountedPrice * quantity;
            totalOfferDiscount += offerDiscount;
        }

        const currDate = Date.now();

        if (subtotal < coupon.minPurchase || coupon.validity < currDate) {
            res.json({ success: false, message: 'The coupon is not valid!' });
            return;
        }

        const couponDiscountAmount = subtotal * coupon.discount / 100;
        const couponDiscount = couponDiscountAmount <= coupon.maxAmount ? couponDiscountAmount : coupon.maxAmount;
        const gst = subtotal * 0.18;
        const totalAmount = subtotal + gst - couponDiscount + (cart.shipping || 0);

        res.status(200).json({
            success: true,
            subtotal: parseFloat(subtotal.toFixed(2)),
            gst: parseFloat(gst.toFixed(2)),
            totalAmount: parseFloat(totalAmount.toFixed(2)),
            couponDiscount: parseFloat(couponDiscount.toFixed(2)),
            couponDescription: coupon.description,
            code
        });

    } catch (err) {
        console.error('Error applying the coupon: ', err);
        res.status(500).send('Internal server error');
    }
}

const toWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);

        // Retrieve the user's wishlist and populate products
        let wishlist = await Wishlist.findOne({ user: userId }).populate('products.product');

        if (!wishlist) {
            wishlist = new Wishlist({
                user: userId,
                products: []
            });
            await wishlist.save();
        }

        const cart = await Cart.findOne({ user: userId }).populate('products.product');
        let subtotal = 0;

        if (cart) {
            subtotal = cart.products.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
        }

        const cartProductIds = cart ? cart.products.map(item => item.product._id.toString()) : [];

        wishlist.products = wishlist.products.filter(item => 
            !cartProductIds.includes(item.product._id.toString())
        );

        await wishlist.save();

        const wishlistProductIds = wishlist.products.map(item => item.product._id);

        const products = await Product.find({ _id: { $in: wishlistProductIds }, isListed: true })
            .populate({
                path: 'category',
                match: { isListed: true }
            })
            .populate({
                path: 'brand',
                match: { isListed: true }
            });

        res.render('wishlist', {
            user,
            userId,
            cart,
            subtotal,
            products
        });

    } catch (err) {
        console.error('Error fetching wishlist', err);
        res.status(500).send('Internal server error');
    }
};

const addToWishlist = async (req, res) => {
    try {
        const user = req.session.user;
        const productId = req.params.product_id;

        const cart = await Cart.findOne({ user: user._id });
        if (cart) {
            const isInCart = cart.products.some(item => item.product.toString() === productId);
            if (isInCart) {
                return res.json({ success: false, inCart: true, message: 'Product is already in the cart!' });
            }
        }

        let wishlist = await Wishlist.findOne({ user: user._id });
        if (!wishlist) {
            wishlist = new Wishlist({
                user: user._id,
                products: []
            });
        }

        const existingProduct = wishlist.products.find(item => item.product.toString() === productId);
        if (existingProduct) {
            return res.json({ success: false, existing: true, message: 'Product already added!' });
        }

        wishlist.products.push({ product: productId });
        await wishlist.save();

        res.status(200).json({ success: true, message: 'Product added to wishlist!' });
    } catch (err) {
        console.error('Error adding to wishlist: ', err);
        res.status(500).send('Internal server error');
    }
};

const removeFromWishlist = async (req, res) => {
    try {
        const userId = req.session.user._id;
        const productId = req.params.product_id;

        const wishlist = await Wishlist.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: 'Wishlist not found' });
        }

        wishlist.products = wishlist.products.filter(item => item.product.toString() !== productId);

        await wishlist.save();

        res.json({ success: true, message: 'Product removed from wishlist' });
    } catch (err) {
        console.error('Error removing product from wishlist:', err);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const toWallet = async (req, res) => {
    try {
        const user = req.session.user;
        const wallet = await Wallet.findOne({ user: user._id });
        console.log(wallet);
        
        res.render('wallet', { user, wallet });
    } catch (err) {
        console.error('Error fetching wallet: ', err);
        res.status(500).send('Internal server error');
    }
}



module.exports = {
    userHome,
    userLogin,
    verifyLogin,
    signup,
    verifySignup,
    getVerifyOtp,
    verifyOtp,
    resendOtp,
    userLogout,
    toshop,
    toProdDetails,
    toUserProfile,
    toEditProfile,
    editProfile,
    toChangePass,
    verifyChangePass,
    toAddr,
    toAddAddr,
    verifyAddAddr,
    deleteAddress,
    toEditAddress,
    verifyEditAddress,
    toCart,
    addToCart,
    deleteCartItem,
    updateCart,
    toCheckout,
    createOrder,
    toOrderConf,
    toOrderHistory,
    toOrderDetails,
    cancelProduct,
    returnProduct,
    forgotPass,
    verifyForgotPass,
    resetForgotPass,
    verifyResetPass,
    applyCoupon,
    // removeCoupon,
    toWishlist,
    addToWishlist,
    removeFromWishlist,
    toWallet,
}