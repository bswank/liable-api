exports.catchErrors = (fn) => {
  return function (req, res, next) {
    return fn(req, res, next).catch(next)
  }
}

exports.notFound = (req, res, next) => {
  const err = new Error('Not Found')
  err.status = 404
  next(err)
}

exports.flashValidationErrors = (err, req, res, next) => {
  if (!err.errors) return next(err)
  // validation errors format
  const errorKeys = Object.keys(err.errors)
  return errorKeys.forEach(key => res.status(400).send({ error: [err.errors[key].message] }))
}

exports.developmentErrors = (err, req, res, next) => {
  res.status(err.status || 500).send({
    error: [err.message]
  })
}

exports.productionErrors = (err, req, res, next) => {
  res.send({
    error: err.message
  })
}
