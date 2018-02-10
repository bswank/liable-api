const passport = require('passport')
const mongoose = require('mongoose')
const User = mongoose.model('User')
const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt-nodejs')
const postmark = require('postmark')
const client = new postmark.Client(process.env.POSTMARK_API_KEY)

const jwtSignUser = (user) => {
  const tokenExpiresIn = 60 * 60 * 24 * 7 * 52
  return jwt.sign(
    user,
    process.env.JWT_SECRET,
    { expiresIn: tokenExpiresIn }
  )
}

exports.isAuthenticated = (req, res, next) => {
  passport.authenticate('jwt', function (err, user) {
    if (err || !user) {
      res.status(403).send({
        error: ['Authentication Failed / Access Denied']
      })
    } else {
      req.user = user
      next()
    }
  })(req, res, next)
}

exports.login = async (req, res) => {
  const user = await User.findOne({ email: req.body.email })

  if (!user) {
    return res.status(403).send({ error: ['Sorry! No user with that email address'] })
  }

  if (!bcrypt.compareSync(req.body.password, user.password)) {
    return res.status(403).send({ error: ['Oops! Looks like an incorrect password'] })
  }

  res.send({
    user: user.toJSON(),
    token: jwtSignUser(user.toJSON())
  })
}

exports.logout = (req, res) => {
  res.send('Success')
}

exports.forgotPassword = async (req, res) => {
  const user = await User.findOne({ email: req.body.email })

  if (!user) {
    return res.send(['User not found.'])
  }

  user.resetPasswordToken = crypto.randomBytes(10).toString('hex')
  user.resetPasswordExpires = Date.now() + 3600000

  await user.save()

  const resetURL = `http://localhost:8080/account/reset/${user.resetPasswordToken}`

  client.sendEmail({
    'From': 'notify@liableapp.com',
    'To': user.email,
    'Subject': `Password Reset Requested`,
    'HtmlBody': `
      <p>Hey, ${user.firstName || 'there'}!</p>
      <p>Looks like you ran into some issues logging into Liable. Here's your password reset link: ${resetURL}.</p>
      <p>If you didn't request this reset, your can safely ignore this email.</p>
      <p>Thanks!<br>Liable</p>
    `
  }, (err) => {
    if (err) {
      return console.log(err)
    }
  })

  res.send([`Password reset link sent`])
}

exports.resetPassword = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.body.token.toString(),
    resetPasswordExpires: { $gt: Date.now() }
  })

  if (!user) {
    return res.status(403).send({ error: ['Invalid or Expired Reset Token'] })
  }

  res.send(user)
}

exports.updatePassword = async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.body.token.toString(),
    resetPasswordExpires: { $gt: Date.now() }
  })

  if (req.body.password !== req.body.passwordConfirm) {
    return res.status(400).send({ error: ['Passwords Must Match'] })
  }

  user.resetPasswordToken = undefined
  user.resetPasswordExpires = undefined

  const updatedUser = await user.save()

  res.send({
    user: updatedUser.toJSON(),
    token: jwtSignUser(updatedUser.toJSON())
  })
}
