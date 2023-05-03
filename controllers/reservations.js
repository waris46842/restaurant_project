// const request = require('request');
const sendNotification = require('../services/line');
const Restaurant = require('../models/Restaurant');
const Reservation = require('../models/Reservation');

//@desc     Get all reservations
//@route    GET /api/v1/reservations
//@access   Public
exports.getReservations = async (req,res,next) => {
    let query;
    if(req.user.role !== 'admin') {
        query = Reservation.find({user:req.user.id}).populate({
            path: 'restaurant',
            select: 'name address tel'
        });
    } else { //If you are an admin, you can see all
        query = Reservation.find().populate({
            path: 'restaurant',
            select: 'name address tel'
        });
    }
    try {
        const reservations = await query;
        res.status(200).json({
            success: true,
            count: reservations.length,
            data: reservations
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: "Cannot find Reservation"})
    }
};

//@desc     Get single reservation
//@route    GET /api/v1/reservations/:id
//@access   Public
exports.getReservation = async (req,res,next) => {
    let reservation
    try {
        if(req.user.role !== 'admin') {
            reservation = await Reservation.find({_id: req.params.id, user: req.user.id}).populate({
                path: 'restaurant',
                select: 'name address tel'
            });
        } else {
            reservation = await Reservation.find({_id: req.params.id}).populate({
                path: 'restaurant',
                select: 'name address tel'
            });
        }

        if(!reservation) {
            return res.status(404).json({success:false, message: `No reservation with the id of ${req.params.id}`});
        }
        else if(!reservation.length) {
            return res.status(404).json({success:false, message: `User ${req.user.id} does not have reservation with the id of ${req.params.id}`})
        }

        res.status(200).json({
            success: true,
            data: reservation
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message:"Cannot find Reservation"});
    }
};

//@desc     Add Reservation
//@route    POST /api/v1/restaurants/:restaurantId/reservation
//@access   Private
exports.addReservation = async (req,res,next) => {
    try {
        req.body.restaurant = req.params.restaurantId;
        const restaurant = await Restaurant.findById(req.params.restaurantId);
        if(!restaurant) {
            return res.status(404).json({success: false, message: `No restaurant with the id of ${req.params.restaurantId}`});
        }
        //add user Id to req.body
        req.body.user = req.user.id;
        //Check for existed reservation
        const existedReservations = await Reservation.find({user:req.user.id});
        //If the user is not an admin, they can only create 3 reservations.
        if(existedReservations.length>=3 && req.user.role !== 'admin') {
            return res.status(400).json({success: false, message: `The user with ID ${req.user.id} has already made 3 reservations`});
        }

        const reserveDate = Date.parse(req.body.reserveDate)
        if(reserveDate < Date.parse(restaurant.open_time) || reserveDate > Date.parse(restaurant.close_time)) {
            return res.status(400).json({success: false, message: `Cannot make a reservation at ${req.body.reserveDate}`})
        }
        let prefix
        if(req.body.seat < 1) {
            return res.status(400).json({success: false, message: `Cannot reserve with number of seats below 1`});
        }else if(req.body.seat <= 2) {
            prefix = 'A'
        } else if(req.body.seat <= 4) {
            prefix = 'B'
        } else {
            prefix = 'C'
        }
        const reservationQueue = await Reservation.find({prefix: prefix}).sort({"queue":-1}).limit(1)
        let nextQueue = 1
        if(reservationQueue.length != 0) {
            nextQueue = reservationQueue[0].queue + 1
        }
        req.body.prefix = prefix
        req.body.queue = nextQueue
        
        const reservation = await Reservation.create(req.body);
        res.status(200).json({
            success: true,
            data: reservation
        });
        sendNotification('CREATE', reservation);
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: "Cannot create Reservation"});
    }
};

//@desc     Update reservation
//@route    PUT /api/v1/reservations/:id
//@access   Private
exports.updateReservation = async (req,res,next) => {
    try {
        let reservation = await Reservation.findById(req.params.id);
        const restaurant = await Restaurant.findById(req.body.restaurant);
        if(!reservation) {
            return res.status(404).json({success: false, message: `No reservation with the id of ${req.params.id}`});
        }
        //Make sure user is the reservation owner
        if (reservation.user.toString()!==req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({success: false, message: `User ${req.user.id} is not authorized to update this reservation`});
        }
        
        const reserveDate = Date.parse(req.body.reserveDate)
        if(reserveDate < Date.parse(restaurant.open_time) || reserveDate > Date.parse(restaurant.close_time)) {
            return res.status(400).json({success: false, message: `Cannot edit a reservation at ${req.body.reserveDate}`})
        }
        
        if(req.body.seat) {
            let prefix = ''
            if(req.body.seat < 1) {
                return res.status(400).json({success: false, message: `Cannot update reserve with number of seats below 1`});
            }else if(req.body.seat <= 2) {
                prefix = 'A'
            } else if(req.body.seat <= 4) {
                prefix = 'B'
            } else {
                prefix = 'C'
            }
            if(reservation.prefix.toString() != prefix) {
                const reservationQueue = await Reservation.find({prefix: prefix}).sort({"queue":-1}).limit(1)
                let nextQueue = 1
                if(reservationQueue.length != 0) {
                    nextQueue = reservationQueue[0].queue + 1
                }
                req.body.prefix = prefix
                req.body.queue = nextQueue
            }
        }
        reservation = await Reservation.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });
        res.status(200).json({
            success: true,
            data: reservation
        });
        sendNotification('UPDATE', reservation);
    } catch (error) {
        return res.status(500).json({success: false, message: "Cannot update Reservation"});
    }
}

//@desc     Delete reservation
//@route    DELETE /api/v1/reservations/:id
//@access   Private
exports.deleteReservation = async (req,res,next) => {
    try {
        const reservation = await Reservation.findById(req.params.id);
        if(!reservation) {
            return res.status(404).json({success: false, message: `No reservation with the id of ${req.params.id}`});
        }
        //Make sure user is the reservation owner
        if (reservation.user.toString()!==req.user.id && req.user.role !== 'admin') {
            return res.status(401).json({success: false, message: `User ${req.user.id} is not authorized to delete this reservation`});
        }
        await reservation.remove();
        res.status(200).json({
            success: true,
            data: {}
        });
        sendNotification('DELETE', reservation);
    } catch (error) {
        console.log(error);
        return res.status(500).json({success: false, message: "Cannot delete Reservation"});
    }
};