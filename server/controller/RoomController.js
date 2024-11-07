const { Room, Category, Item } = require('../models')

class Controller {

    static async read(req, res, next) {
        try {
            const room = await Room.findAll({
                include: [{
                    model: Category,
                    include: [{
                        model: Item
                    }]
                }]
            })
            res.status(200).json({ room })
        } catch (error) {
            next(error)
        }
    }

    static async readOne(req, res, next) {
        try {
            const { id } = req.params
            const room = await Room.findByPk(id, {
                include: [{
                    model: Category,
                    include: [{
                        model: Item
                    }]
                }]
            })
            if (!room) throw { name: "RoomNotFound" }

            res.status(200).json({ room })
        } catch (error) {
            next(error)
        }
    }

    static async create(req, res, next) {
        try {
            const { name, CategoryId, maxPlayer, game } = req.body
            const room = await Room.create({ 
                name, 
                CategoryId, 
                maxPlayer, 
                game 
            })

            // Fetch room dengan Category dan Items
            const roomWithData = await Room.findByPk(room.id, {
                include: [{
                    model: Category,
                    include: [{
                        model: Item
                    }]
                }]
            })

            res.status(201).json({ 
                message: "Room created successfully", 
                room: roomWithData 
            })
        } catch (error) {
            next(error)
        }
    }

    static async updateStatus(req, res, next) {
        try {
            const { id } = req.params
            const room = await Room.findByPk(id)
            if (!room) throw { name: "RoomNotFound" }

            room.status = "playing"
            await room.save()

            res.status(200).json({ message: "Room status updated successfully", room })
        } catch (error) {
            next(error)
        }
    }

    static async delete(req, res, next) {
        try {
            const { id } = req.params
            const room = await Room.findByPk(id)
            if (!room) throw { name: "RoomNotFound" }

            await Room.destroy({ where: { id } })
            res.status(200).json({ message: "Room deleted successfully", room })
        } catch (error) {
            next(error)
        }
    }
}

module.exports = Controller