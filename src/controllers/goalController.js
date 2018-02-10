const mongoose = require('mongoose')
const User = mongoose.model('User')
const Goal = mongoose.model('Goal')
const moment = require('moment')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const postmark = require('postmark')
const client = new postmark.Client(process.env.POSTMARK_API_KEY)

exports.listGoals = async (req, res) => {
  const goals = await Goal.find({ planner: req.user._id })
  res.send(goals)
}

exports.checkin = async (req, res) => {
  const goal = await Goal.findOne({
    checkinToken: req.body.token.toString(),
    checkinExpires: { $gt: Date.now() }
  }).populate('planner')

  if (!goal) {
    return res.status(403).send({ error: ['This Check-In URL is Expired'] })
  }

  if (goal.goalType === 'One Time') {
    if (req.body.result === 'yes') {
      client.sendEmail({
        'From': 'notify@liableapp.com',
        'To': goal.planner.email,
        'Subject': 'Great Job!',
        'HtmlBody': `
          <p>Hey, ${goal.planner.firstName || 'there'}!</p>
          <p>You set a goal to ${goal.title} by ${goal.endDate} and your accountability partner, ${goal.accountabilityPartnerFirstName}, reported that you met your goal. Congratulations!</p>
          <p>Thanks!<br>Liable</p>
        `
      }, (err) => {
        if (err) {
          return console.log(err)
        }
      })
      goal.checkinToken = undefined
      goal.checkinExpires = undefined
      goal.nextCheck = undefined
      goal.completed = true
    } else {
      if (goal.incentive) {
        await stripe.charges.create({
          amount: goal.incentive,
          currency: 'usd',
          customer: goal.planner.stripeCustomerId,
          description: 'Incentive/Motivational Payment'
        })
      }
      client.sendEmail({
        'From': 'notify@liableapp.com',
        'To': goal.planner.email,
        'Subject': 'Oops! You missed your deadline!',
        'HtmlBody': `
          <p>Hey, ${goal.planner.firstName || 'there'}!</p>
          <p>You set a goal to ${goal.title} and the due date just passed. Your accountability partner, ${goal.accountabilityPartnerFirstName}, reported that you have not yet completed your goal, so we've gone ahead and extended the deadline by a week.</p>
          <p>If you set an incentive, your card was charged ${goal.incentive || 'that amount'} and you'll receive a receipt via email.</p>
          <p>Keep at it! We're pulling for you!</p>
          <p>Thanks!<br>Liable</p>
        `
      }, (err) => {
        if (err) {
          return console.log(err)
        }
      })
      goal.checkinToken = undefined
      goal.checkinExpires = undefined
      goal.endDate = moment().add(1, 'week')
      goal.nextCheck = moment().add(1, 'week')
    }
  } else {
    if (req.body.result === 'yes') {
      goal.checkinToken = undefined
      goal.checkinExpires = undefined
      goal.nextCheck = moment().add(1, goal.accountabilityFrequency)
      client.sendEmail({
        'From': 'notify@liableapp.com',
        'To': goal.planner.email,
        'Subject': 'Great Job!',
        'HtmlBody': `
          <p>Hey, ${goal.planner.firstName || 'there'}!</p>
          <p>You set a goal to ${goal.title} and your accountability partner, ${goal.accountabilityPartnerFirstName}, reported that you're doing great. Keep it up!</p>
          <p>Thanks!<br>Liable</p>
        `
      }, (err) => {
        if (err) {
          return console.log(err)
        }
      })
    } else {
      if (goal.incentive) {
        await stripe.charges.create({
          amount: goal.incentive,
          currency: 'usd',
          customer: goal.planner.stripeCustomerId,
          description: 'Incentive/Motivational Payment'
        })
      }
      goal.checkinToken = undefined
      goal.checkinExpires = undefined
      goal.nextCheck = moment().add(1, goal.accountabilityFrequency)
      client.sendEmail({
        'From': 'notify@liableapp.com',
        'To': goal.planner.email,
        'Subject': 'Oops! Come up short? ',
        'HtmlBody': `
          <p>Hey, ${goal.planner.firstName || 'there'}!</p>
          <p>You set a goal to ${goal.title} and your accountability partner, ${goal.accountabilityPartnerFirstName}, reported recently that you have not been keeping up with your goal. You've got this!</p>
          <p>If you set an incentive, your card was charged ${goal.incentive || 'that amount'} and you'll receive a receipt via email.</p>
          <p>Keep at it! We're pulling for you!</p>
          <p>Thanks!<br>Liable</p>
        `
      }, (err) => {
        if (err) {
          return console.log(err)
        }
      })
    }
  }

  await goal.save()

  res.send(['Your check-in has been recorded. Thanks!'])
}

exports.checkinGoal = async (req, res) => {
  const goal = await Goal.findOne({
    checkinToken: req.body.token.toString()
  }).populate('planner')

  if (!goal) {
    return res.status(403).send({ error: ['This Check-In URL is Expired'] })
  }

  res.send(goal)
}

exports.validateGoal = (req, res, next) => {
  req.sanitizeBody('title')
  req.checkBody('title', 'Description is required').notEmpty()

  req.sanitizeBody('incentive')

  req.sanitizeBody('accountabilityFrequency')
  req.checkBody('accountabilityFrequency', 'Frequency is required').notEmpty()

  req.sanitizeBody('accountabilityPartnerFirstName')
  req.checkBody('accountabilityPartnerFirstName', 'Accountability Partner First Name is required').notEmpty()

  req.sanitizeBody('accountabilityPartners.email')
  req.checkBody('accountabilityPartnerEmail', 'Accountability Partner Email is required').notEmpty()
  req.checkBody('accountabilityPartnerEmail', 'Accountability Partner Email must be valid').isEmail()
  req.sanitizeBody('accountabilityPartnerEmail').normalizeEmail()

  const errors = req.validationErrors()
  if (errors) {
    return res.status(400).send({
      error: errors.map(err => err.msg)
    })
  }

  next()
}

exports.createGoal = async (req, res) => {
  let nextCheck = moment().add(1, req.body.accountabilityFrequency)
  if (req.body.endDate) {
    nextCheck = req.body.endDate
  }
  let incentive
  if (!req.body.incentive === undefined) {
    incentive = req.body.incentive * 100
  }
  const newGoal = await new Goal({
    title: req.body.title,
    incentive: incentive || req.body.incentive,
    accountabilityFrequency: req.body.accountabilityFrequency,
    accountabilityPartnerEmail: req.body.accountabilityPartnerEmail,
    accountabilityPartnerFirstName: req.body.accountabilityPartnerFirstName,
    planner: req.body.planner,
    endDate: req.body.endDate,
    goalType: req.body.goalType,
    completed: false,
    cancelled: false,
    nextCheck
  }).save()

  const goal = await Goal.findOne({ _id: newGoal._id }).populate('planner')

  const user = await User.findOne({ _id: req.body.planner })
  user.goals.push(newGoal)
  user.save()

  if (goal.goalType === 'One Time') {
    client.sendEmail({
      'From': 'notify@liableapp.com',
      'To': goal.accountabilityPartnerEmail,
      'Subject': `${goal.planner.firstName || 'Your friend'} just set a new goal!`,
      'HtmlBody': `
        <p>Hey, ${goal.accountabilityPartnerFirstName || 'there'}!</p>
        <p>${goal.planner.firstName || 'Your friend'} just set a goal to ${goal.title} and asked if you would be his/her accountability partner. You'll recieve an email around the deadline reminding you to check in with ${goal.planner.firstName} and report back. If they accomplished their goal, that's it! If not, we'll push the due date a week automatically and you'll receive another reminder to check in.</p>
        <p>Thanks!<br>Liable</p>
      `
    }, (err) => {
      if (err) {
        return console.log(err)
      }
    })
  } else {
    client.sendEmail({
      'From': 'notify@liableapp.com',
      'To': goal.accountabilityPartnerEmail,
      'Subject': `${goal.planner.firstName || 'Your friend'} just set a new goal!`,
      'HtmlBody': `
        <p>Hey, ${goal.accountabilityPartnerFirstName || 'there'}!</p>
        <p>${goal.planner.firstName || 'Your friend'} just set a goal to ${goal.title} and asked if you would be his/her accountability partner. You'll recieve emails every ${goal.accountabilityFrequency || 'so often'} reminding you to check in with ${goal.planner.firstName} and report back.</p>
        <p>Thanks!<br>Liable</p>
      `
    }, (err) => {
      if (err) {
        return console.log(err)
      }
    })
  }

  res.send(goal.data)
}

// exports.edit = async (req, res) => {
//   const user = await User.findOne({ _id: req.body._id })

//   user.firstName = req.body.firstName
//   user.lastName = req.body.lastName
//   user.email = req.body.email
//   user.password = req.body.password

//   const updatedUser = await user.save()

//   res.send(updatedUser)
// }
