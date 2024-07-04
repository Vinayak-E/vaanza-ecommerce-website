const User = require('../models/userModel');

const blockChecking = async (userId) => {
    try {
        const userData = await User.findById(userId);
        return  userData.is_blocked
    } catch (err) {
        console.log(err)
    }
}

module.exports = {
    blockChecking
};