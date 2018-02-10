const mongoose = require('mongoose')
const User = mongoose.model('User')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

exports.validateAccount = async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email })

  if (user && user._id.toString() !== req.body._id) {
    return res.status(400).send({ error: ['User exists.'] })
  }

  if (req.body.password !== req.body.passwordConfirm) {
    return res.status(400).send({ error: ['Passwords Must Match'] })
  }

  req.sanitizeBody('firstName')
  req.sanitizeBody('lastName')
  req.checkBody('firstName', 'Please provide your first name').notEmpty()
  req.checkBody('lastName', 'Please provide your last name').notEmpty()
  req.checkBody('email', 'Please provide your email address').notEmpty()
  req.checkBody('email', 'Please provide a valid email address').isEmail()
  req.sanitizeBody('email').normalizeEmail()
  req.checkBody('password', 'Please provide a password').notEmpty()
  req.checkBody('passwordConfirm', 'Please confirm your password').notEmpty()
  req.checkBody('passwordConfirm', 'Passwords must match').equals(req.body.password)

  const errors = req.validationErrors()
  if (errors) {
    return res.status(400).send({
      error: errors.map(err => err.msg)
    })
  }

  next()
}

exports.register = async (req, res, next) => {
  await new User({
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    password: req.body.password
  }).save()

  next()
}

exports.edit = async (req, res) => {
  const user = await User.findOne({ _id: req.body._id })

  user.firstName = req.body.firstName
  user.lastName = req.body.lastName
  user.email = req.body.email
  user.password = req.body.password

  const updatedUser = await user.save()

  res.send(updatedUser)
}

exports.updateCard = async (req, res) => {
  const user = await User.findOne({ email: req.user.email })
  const token = req.body.id

  if (user.stripeCustomerId) {
    const stripeCustomer = req.user.stripeCustomerId
    const customer = await stripe.customers.retrieve(
      stripeCustomer
    )

    if (customer.default_source) {
      const defaultSource = customer.default_source
      await stripe.customers.deleteCard(stripeCustomer, defaultSource)
    }

    const source = await stripe.customers.createSource(stripeCustomer, {
      source: token
    })

    user.paymentSource.id = source.id
    user.paymentSource.expirationMonth = source.exp_month
    user.paymentSource.expirationYear = source.exp_year
    user.paymentSource.lastFour = source.last4
    user.paymentSource.cardType = source.brand

    await user.save()
  } else {
    const customer = await stripe.customers.create({
      email: req.user.email
    })

    const source = await stripe.customers.createSource(customer.id, {
      source: token
    })

    user.stripeCustomerId = customer.id
    user.paymentSource.expirationMonth = source.exp_month
    user.paymentSource.expirationYear = source.exp_year
    user.paymentSource.lastFour = source.last4
    user.paymentSource.cardType = source.brand

    await user.save()
  }
  res.send(user)
}

exports.removeCard = async (req, res) => {
  const user = await User.findOne({ email: req.user.email })

  if (!user.paymentSource) {
    user.paymentSource = undefined
    await user.save()
    return res.send(user)
  }

  const stripeCustomer = req.user.stripeCustomerId
  const customer = await stripe.customers.retrieve(
    stripeCustomer
  )
  const defaultSource = customer.default_source
  await stripe.customers.deleteCard(stripeCustomer, defaultSource)

  user.paymentSource = undefined

  await user.save()

  res.send(user)
}
