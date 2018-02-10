const express = require('express')
const adminRouter = express.Router()
const admin = require('../controllers/adminController')
const { catchErrors } = require('../handlers/errorHandlers')

adminRouter.get('/admin', admin.isAdmin, catchErrors(admin.userCount))

module.exports = adminRouter
