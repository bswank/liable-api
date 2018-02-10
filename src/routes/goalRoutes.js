const express = require('express')
const goalRouter = express.Router()
const auth = require('../controllers/authController')
const goal = require('../controllers/goalController')
const { catchErrors } = require('../handlers/errorHandlers')

goalRouter.get('/goals',
  auth.isAuthenticated,
  catchErrors(goal.listGoals)
)

goalRouter.post('/goals/create',
  auth.isAuthenticated,
  goal.validateGoal,
  catchErrors(goal.createGoal)
)

goalRouter.post('/goals/checkin',
  catchErrors(goal.checkin)
)

goalRouter.post('/goals/checkin/goal',
  catchErrors(goal.checkinGoal)
)

module.exports = goalRouter
