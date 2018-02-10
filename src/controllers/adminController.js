const mongoose = require('mongoose')
const User = mongoose.model('User')

exports.isAdmin = (req, res, next) => {
  if (!req.user || req.user.isAdmin === false) {
    return res.status(401).send({ error: 'Unauthorized User' })
  }
  next()
}

exports.userCount = async (req, res) => {
  const numOfUsers = await User.count()
  res.send({ numOfUsers })
}
