const mongoose =require('mongoose')

const RestaurantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please add a name'],
        unique: true,
        trim: true,
        maxlength: [50, 'Name cannot be more than 50 characters']
    },
    address: {
        type: String,
        required: [true, 'Please add an address']
    },
    tel: {
        type: String
    },
    open_time: {
        type: Date,
        required: [true, 'Please add open time']
    },
    close_time: {
        type: Date,
        required: [true, 'Please add close time']
    }
}, {
    toJSON: {virtuals: true},
    toObject: {virtuals: true}
})

//Cascade delete reservations when a restaurant is deleted
RestaurantSchema.pre('remove', async function(next) {
    console.log(`Reservations being removed from restaurant ${this._id}`);
    await this.model('Reservation').deleteMany({restautant: this._id});
    next();
});

//Reverse populate with virtuals
RestaurantSchema.virtual('reservations', {
    ref: 'Restaurant',
    localField: '_id',
    foreignField: 'restaurant',
    justOne: false
});

module.exports = mongoose.model('Restaurant', RestaurantSchema);