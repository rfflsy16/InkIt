const errorHandler = (err, req, res, next) => {
    console.log(err);
    
    let status = 500
    let message = "Internal server error"

    switch (err.name) {
        case "SequelizeValidationError":
            status = 400
            message = err.errors.map(el => el.message).join(", ")
            break
        case "RoomNotFound":
            status = 404
            message = "Room not found"
            break
    }

    res.status(status).json({ message });
};

module.exports = errorHandler;
