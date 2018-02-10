const express = require('express')
const userRouter = express.Router()
const user = require('../controllers/userController')
const auth = require('../controllers/authController')
const { catchErrors } = require('../handlers/errorHandlers')

userRouter.post('/account/register',
  catchErrors(user.validateAccount),
  catchErrors(user.register),
  catchErrors(auth.login)
)

userRouter.post('/account/edit',
  auth.isAuthenticated,
  catchErrors(user.validateAccount),
  catchErrors(user.edit)
)

userRouter.post('/account/login', catchErrors(auth.login))

userRouter.get('/account/logout', auth.isAuthenticated, auth.logout)

userRouter.post('/account/forgot', catchErrors(auth.forgotPassword))

userRouter.post('/account/reset', catchErrors(auth.resetPassword))

userRouter.post('/account/reset/update', catchErrors(auth.updatePassword))

userRouter.post('/account/card/update',
  auth.isAuthenticated,
  catchErrors(user.updateCard)
)

userRouter.post('/account/card/remove',
  auth.isAuthenticated,
  catchErrors(user.removeCard)
)

module.exports = userRouter
