const passport = require('passport'); 
const GoogleStrategy = require('passport-google-oauth2').Strategy; 
const User = require('./models/userModel')
require('dotenv').config();

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/callback"
},
async (accessToken, refreshToken, profile, done) => {
    try {
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
            user.email = profile.emails[0].value;
            user.name = profile.displayName;
        }
        else {
            user = new User({
                googleId: profile.id,
                email: profile.emails[0].value,
                name: profile.displayName, 
                verified:true,
                is_admin:0
                // Add other profile information
            });
            await user.save();
        }

        return done(null, user);
    } catch (err) {
        return done(err, false);
    }
}));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});

module.exports=passport