// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: pink; icon-glyph: magic;

const SHOW_AMOUNT = 6
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wen', 'Thu', 'Fri', 'Sat']

const timeFormatter = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' })

const getMonthString = (n) => {
  const date = new Date()

  let year = date.getFullYear()
  let month = date.getMonth() + n

  if (month === 13) {
    month = 1
    year += 1
  }

  return `${year}-${month}-1T00:00:00`
}

const widget = await getWidget()

if (config.runsInWidget) {
  // The script runs inside a widget, so we pass our instance of ListWidget to be shown inside the widget on the Home Screen.
  Script.setWidget(widget)
} else {
  // The script runs inside the app, so we preview the widget.
  widget.presentMedium()
}
// Calling Script.complete() signals to Scriptable that the script have finished running.
// This can speed up the execution, in particular when running the script from Shortcuts or using Siri.
Script.complete()

async function makeRequest({
  url,
  method,
  headers,
  body
}) {
  const req = new Request(url)
  req.method = method
  req.headers = { ...headers }
  req.body = body
  return req.loadString()
}

/**
 * @typedef {Object} RawScheduleEvent
 * @property {String} LocalDate
 * @property {Number} StoreID
 * @property {String} StoreCode
 * @property {String} StoreCodeName
 * @property {Number} AcrivityID
 * @property {Number} Start
 * @property {Number} End
 * @property {null} DepartmentID
 *
 * @typedef {Object} ScheduleEvent
 * @property {Date} date
 * @property {Array<RawScheduleEvent>} events
 * @property {Boolean} off
 * @property {Date | null} start
 * @property {Date | null} end
 * @property {String} extra
 */

/**
 * @returns {Promise<Array<RawScheduleEvent>>}
 */
async function getRawSchedule() {
  // Login
  const loginRes = await makeRequest({
    url: 'https://sf.lush.com/storeforce/ess/services/FoundationService.svc/Login',
    method: 'POST',
    headers: {
      'accept-language': 'en-US,en;q=0.9,de;q=0.8,la;q=0.7',
      'content-type': 'application/json; charset=UTF-8',
      'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'x-requested-with': 'XMLHttpRequest',
      Referer: 'https://sf.lush.com/storeforce/ess/',
      'Referrer-Policy': 'strict-origin-when-cross-origin'
    },
    body: JSON.stringify({
      username: '',
      password: '',
      culture: 'en-US'
    })
  })

  const login = JSON.parse(JSON.parse(loginRes))

  const makeMonthlyScheduleReq = async (dateString) => {
    return makeRequest({
      url: 'https://sf.lush.com/storeforce/ess/services/ScheduleService.svc/GetMonthlySchedule',
      method: 'POST',
      headers: {
        'accept-language': 'en-US,en;q=0.9,de;q=0.8,la;q=0.7',
        'content-type': 'application/json; charset=UTF-8',
        'sec-ch-ua': '"Chromium";v="110", "Not A(Brand";v="24", "Google Chrome";v="110"',
        'sec-ch-ua-mobile': '?0',
        'sec-ch-ua-platform': '"macOS"',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'x-requested-with': 'XMLHttpRequest',
        Referer: 'https://sf.lush.com/storeforce/ess/',
        'Referrer-Policy': 'strict-origin-when-cross-origin'
      },
      body: JSON.stringify({
        session: login.Session,
        datestring: dateString,
        culture: 'en-US'
      })
    })
  }

  const payload = []

  payload.push(...JSON.parse(JSON.parse(await makeMonthlyScheduleReq(`"${getMonthString(1)}"`))))

  const today = new Date()
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1)
  const diffDays = Math.ceil(Math.abs(nextMonth.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= SHOW_AMOUNT) {
    payload.push(...JSON.parse(JSON.parse(await makeMonthlyScheduleReq(`"${getMonthString(2)}"`))))
  }

  return payload
}

/**
 * @returns {Promise<Array<ScheduleEvent>>}
 */
async function getSchedule() {
  const raw = await getRawSchedule()

  /** @type {Array<ScheduleEvent>} */
  const days = []

  for (const item of raw) {
    const index = days.findIndex(day => day.date.toDateString() === new Date(item.LocalDate).toDateString())

    if (index > -1) {
      days[index].events.push(item)
    } else {
      days.push({
        date: new Date(item.LocalDate),
        events: [item],
        off: false,
        start: null,
        end: null,
        extra: ''
      })
    }
  }

  for (const day of days) {
    let minStart = Infinity
    let maxEnd = 0

    for (const event of day.events) {
      if (event.Start < minStart) minStart = event.Start
      if (event.End > maxEnd) maxEnd = event.End
    }

    const start = new Date(day.date)
    start.setMinutes(minStart)
    const end = new Date(day.date)
    end.setMinutes(maxEnd)

    day.start = start
    day.end = end

    /**
     * if shift starts between 5:00 - 10:00 = opening
     * if shift ends between 8:00 - 11:00 = closing
     */
    const startHours = start.getHours()
    const endHours = end.getHours()

    if (startHours >= 5 && startHours <= 10) {
      day.extra = '☀️'
    } else if (endHours >= 20 && endHours <= 23) {
      day.extra = '🌜'
    }
  }

  /** @type {Array<ScheduleEvent>} */
  const payload = []

  for (let i = 0; i < SHOW_AMOUNT; i++) {
    const date = new Date(new Date().setDate(new Date().getDate() + i))
    const index = days.findIndex(x => x.date.toDateString() === date.toDateString())

    if (index > -1) {
      payload.push(days[index])
    } else {
      payload.push({
        date,
        events: [],
        off: true,
        start: null,
        end: null,
        extra: ''
      })
    }
  }

  return payload
}

async function getWidget() {
  // Setup widget
  const lw = new ListWidget()

  const darkBlue = new Color('#333d72', 1)
  const darkBlueLighter = new Color('#333d72', 0.6)

  const gradient = new LinearGradient()
  gradient.colors = [Color.dynamic(Color.white(), darkBlueLighter), Color.dynamic(Color.white(), darkBlue)]
  gradient.locations = [0, 1]

  lw.backgroundGradient = gradient
  lw.spacing = 1

  const schedule = await getSchedule()

  for (let i = 0; i < schedule.length; i++) {
    const shift = schedule[i]
    const shiftStack = lw.addStack()

    const dateStack = shiftStack.addStack()
    dateStack.size = new Size(70, 0)

    const day = dateStack.addText(DAYS_OF_WEEK[shift.date.getDay()])
    day.font = Font.boldSystemFont(18)

    dateStack.addSpacer()

    const date = dateStack.addText(shift.date.getDate().toString())
    date.font = Font.boldSystemFont(18)

    shiftStack.addSpacer(20)

    if (shift.off) {
      shiftStack.addText('Off')
    } else {
      let start = timeFormatter.format(shift.start)
      start = start.substring(0, start.length - 3)
      let end = timeFormatter.format(shift.end)
      end = end.substring(0, end.length - 3)

      shiftStack.addText(`${start} - ${end}`)
    }

    shiftStack.addSpacer()

    if (i === 0) {
      // shiftStack.addText('👈')
      // shiftStack.addText('🌜')
    }

    if (shift.extra) {
      shiftStack.addText(shift.extra)
    }
  }

  return lw
}
