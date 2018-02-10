const express = require('express')
const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const cors = require('cors')
const mongoose = require('mongoose')
const expressValidator = require('express-validator')
const errorHandlers = require('./handlers/errorHandlers')

require('dotenv').config()

const postmark = require('postmark')
const client = new postmark.Client(process.env.POSTMARK_API_KEY)

require('./models/User')
require('./models/Goal')

const userRoutes = require('./routes/userRoutes')
const adminRoutes = require('./routes/adminRoutes')
const goalRoutes = require('./routes/goalRoutes')

require('./handlers/passport')

const app = express()

app.use(cors())
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))
app.use(expressValidator())
app.use(cookieParser())
app.use(userRoutes)
app.use(adminRoutes)
app.use(goalRoutes)

// Global error handlers
app.use(errorHandlers.notFound)
app.use(errorHandlers.flashValidationErrors)
// app.use(errorHandlers.developmentErrors)
app.use(errorHandlers.productionErrors)

const db = mongoose.connect(process.env.MONGODB_CONNECTION, { useMongoClient: true })

app.listen(process.env.PORT, () => {
  console.info(`⚡️  Express server started on port ${process.env.PORT}.\n`)
})

db.on('error', console.error.bind(console, 'connection error:'))
db.once('open', () => {
  console.info('⚡  Database connection OK\n')
})

// Cron Jobs:

const schedule = require('node-schedule')
const moment = require('moment')
const Goal = mongoose.model('Goal')
const crypto = require('crypto')

schedule.scheduleJob('1 * * * * *', async () => {
  let yesterday = moment().subtract(1, 'day')
  let today = moment().add(1, 'day')
  const goals = await Goal.find({
    completed: false,
    checkinToken: { $exists: false },
    nextCheck: { $gte: yesterday, $lt: today }
  })
  for (let i = 0; i < goals.length; i++) {
    goals[i].checkinToken = crypto.randomBytes(10).toString('hex')
    goals[i].checkinExpires = Date.now() + 172800000 // 48 hours

    await goals[i].save()

    const checkinURL = `${process.env.SERVER_URL}/checkin/${goals[i].checkinToken}`

    client.sendEmail({
      'From': 'notify@liableapp.com',
      'To': goals[i].accountabilityPartnerEmail,
      'Subject': 'Time to check in & report back!',
      'HtmlBody': `
        <p>Hey, ${goals[i].accountabilityPartnerFirstName || 'there'}!</p>
        <p>It's time to check in on ${goals[i].planner.firstName || 'your friend'} and make sure he/she is sticking to the goal he/she set.</p>
        <p>You have 48 hours to ask them how they're doing and report back by visiting: ${checkinURL}</p>
        <p>Thanks!<br>Liable</p>
      `
    }, (err) => {
      if (err) {
        return console.log(err)
      }
    })
    const goalsWithExpiringCheckins = await Goal.find({
      checkinExpires: { $lt: Date.now() }
    })
    for (let i = 0; i < goalsWithExpiringCheckins.length; i++) {
      if (goalsWithExpiringCheckins[i].goalType === 'One Time') {
        goalsWithExpiringCheckins[i].checkinToken = undefined
        goalsWithExpiringCheckins[i].checkinExpires = undefined
        goalsWithExpiringCheckins[i].endDate = moment().add(1, 'week')
        goalsWithExpiringCheckins[i].nextCheck = moment().add(1, 'week')
        await goalsWithExpiringCheckins[i].save()
        client.sendEmail({
          'From': 'notify@liableapp.com',
          'To': goalsWithExpiringCheckins[i].planner.email,
          'Subject': 'Looks like you missed a check in!',
          'HtmlBody': `
            <p>Hey, ${goalsWithExpiringCheckins[i].planner.firstName || 'there'}!</p>
            <p>You set a goal to ${goalsWithExpiringCheckins[i].title} and the due date just passed. Your accountability partner, ${goalsWithExpiringCheckins[i].accountabilityPartnerFirstName}, missed the scheduled check in, so we've gone ahead and extended the deadline by a week.</p>
            <p>Keep at it! We're pulling for you!</p>
            <p>Thanks!<br>Liable</p>
          `
        }, (err) => {
          if (err) {
            return console.log(err)
          }
        })
      } else {
        goalsWithExpiringCheckins[i].checkinToken = undefined
        goalsWithExpiringCheckins[i].checkinExpires = undefined
        goalsWithExpiringCheckins[i].nextCheck = moment().add(1, goalsWithExpiringCheckins[i].accountabilityFrequency)
        await goalsWithExpiringCheckins[i].save()
        client.sendEmail({
          'From': 'notify@liableapp.com',
          'To': goalsWithExpiringCheckins[i].planner.email,
          'Subject': 'Looks like you missed a check in!',
          'HtmlBody': `
            <p>Hey, ${goalsWithExpiringCheckins[i].planner.firstName || 'there'}!</p>
            <p>You set a goal to ${goalsWithExpiringCheckins[i].title} and it looks like your accountability partner, ${goalsWithExpiringCheckins[i].accountabilityPartnerFirstName}, missed your check in, so we skipped this one.</p>
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
  }
})
