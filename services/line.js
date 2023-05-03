const request = require('request');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');

module.exports = async function (method, reserveData) {


    const restaurant = await Restaurant.findById(reserveData.restaurant);
    const user = await User.findById(reserveData.user);

    const generateMessage = function(method, user, restaurant, reserveData) {
        return `\nmethod: ${method}\nname: ${user.name}\nrestaurant: ${restaurant.name}\nreserveDate: ${reserveData.reserveDate}\nqueue: ${reserveData.prefix + reserveData.queue}\ncreatedAt: ${reserveData.createdAt}`
    }
    message = generateMessage(method, user, restaurant, reserveData)
    request({
        method: 'POST',
        uri: "https://notify-api.line.me/api/notify",
        header: {
            'Content-Type': 'multipart/form-data',
        },
        auth: {
            bearer: process.env.LINE_TOKEN,
        },
        form: {
            message: message
        },
    }, (err, httpResponse, body) => {
        if (err) {
            console.log(err)
        } else {
            console.log(body)
        }
    });
}