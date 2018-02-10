const mongoose = require('mongoose')
const validator = require('validator')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise
const mongodbErrorHandler = require('mongoose-mongodb-errors')

const goalSchema = new Schema({
  title: {
    type: String,
    required: 'Title Required'
  },
  incentive: {
    type: Number
  },
  accountabilityFrequency: {
    type: String,
    required: 'Frequency Required'
  },
  accountabilityPartnerFirstName: {
    type: String,
    trim: true,
    required: 'Accountbility Partner Name Required'
  },
  accountabilityPartnerEmail: {
    type: String,
    trim: true,
    lowercase: true,
    required: 'Accountbility Partner Email Required',
    validate: {
      isAsync: true,
      validator: (v, cb) => {
        cb(validator.isEmail(v))
      },
      message: '{VALUE} is not a valid email address.'
    }
  },
  planner: {
    type: Schema.Types.ObjectId,
    ref: 'User'
  },
  nextCheck: Date,
  endDate: Date,
  goalType: String,
  completed: Boolean,
  cancelled: Boolean,
  checkinToken: String,
  checkinExpires: Date
})

goalSchema.plugin(mongodbErrorHandler)

module.exports = mongoose.model('Goal', goalSchema)
