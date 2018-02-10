const mongoose = require('mongoose')
const Schema = mongoose.Schema
mongoose.Promise = global.Promise
const validator = require('validator')
const mongodbErrorHandler = require('mongoose-mongodb-errors')
const bcrypt = require('bcrypt-nodejs')

const userSchema = new Schema({
  firstName: {
    type: String,
    trim: true,
    required: 'First Name Required'
  },
  lastName: {
    type: String,
    trim: true,
    required: 'Last Name Required'
  },
  email: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true,
    required: 'Email Required',
    validate: {
      isAsync: true,
      validator: (v, cb) => {
        cb(validator.isEmail(v))
      },
      message: '{VALUE} is not a valid email address.'
    }
  },
  password: {
    type: String,
    required: 'Password Required'
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  goals: [{ type: Schema.Types.ObjectId, ref: 'Goal'
  }],
  stripeCustomerId: String,
  paymentSource: {
    id: String,
    cardType: String,
    lastFour: String,
    expirationYear: String,
    expirationMonth: String
  }
})

userSchema.pre('save', function (next) {
  const user = this
  if (!user.isModified('password')) return next()
  bcrypt.genSalt(10, function (err, salt) {
    if (err) return next(err)
    bcrypt.hash(user.password, salt, null, function (err, hash) {
      if (err) return next(err)
      user.password = hash
      next()
    })
  })
})

userSchema.plugin(mongodbErrorHandler)

module.exports = mongoose.model('User', userSchema)
