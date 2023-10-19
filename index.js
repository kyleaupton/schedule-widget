// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: gray; icon-glyph: magic;
const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wen', 'Thu', 'Fri', 'Sat']
const timeFormatter = new Intl.DateTimeFormat('en-US', { timeStyle: 'short' })

const getToday = () => {
  const date = new Date()
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}T00:00:00`
}

// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-color: yellow; icon-glyph: magic;
const widget = await getWidget()
widget.setPadding(10, 20, 10, 20)

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

async function getWidget() {
  // Setup widget
  const widget = new ListWidget()
  // widget.backgroundColor = new Color('#D3D3D3', 1)
  widget.backgroundColor = Color.white()

  const schedule = await getSchedule()
  const today = getToday()
  console.log(today)
  const todayIndex = schedule.findIndex(item => item.LocalDate === today)
  const nextShifts = schedule.slice(todayIndex, todayIndex + 6)

  for (const shift of nextShifts) {
    const shiftStack = widget.addStack()

    const dateStack = shiftStack.addStack()
    dateStack.size = new Size(70, 0)

    const day = dateStack.addText(DAYS_OF_WEEK[shift.Start.getDay()])
    day.textColor = Color.black()
    day.font = Font.boldSystemFont(18)

    dateStack.addSpacer()

    const date = dateStack.addText(shift.Start.getDate().toString())
    date.textColor = Color.black()
    date.font = Font.boldSystemFont(18)

    if (shift.emoji) {
      shiftStack.addSpacer(10)
      const emoji = shiftStack.addText(shift.emoji)
      emoji.font = Font.footnote()
    }

    shiftStack.addSpacer()

    let start = timeFormatter.format(shift.Start)
    start = start.substring(0, start.length - 3)
    let end = timeFormatter.format(shift.End)
    end = end.substring(0, end.length - 3)
    const startEnd = shiftStack.addText(`${start} - ${end}`)
    startEnd.textColor = Color.black()
  }

  return widget
}

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

async function getSchedule() {
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

  const scheduleRes = await makeRequest({
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
      datestring: `"${getToday()}"`,
      culture: 'en-US'
    })
  })

  const schedule = JSON.parse(JSON.parse(scheduleRes))

  const processedSchedule = []

  for (const item of schedule) {
    // Check to see if `LocalDate` entry exists
    const index = processedSchedule.findIndex(x => x.LocalDate === item.LocalDate)

    if (index > -1) {
      processedSchedule[index].events.push(item)
    } else {
      processedSchedule.push({
        LocalDate: item.LocalDate,
        events: [item],
        Start: new Date(),
        End: new Date(),
        emoji: null
      })
    }
  }

  for (const item of processedSchedule) {
    // Set start and end times
    let minStart = Infinity
    let maxEnd = 0

    for (const event of item.events) {
      if (event.Start < minStart) minStart = event.Start
      if (event.End > maxEnd) maxEnd = event.End
    }

    const temp = new Date(`${item.LocalDate}`)
    const startTime = new Date(temp)
    const endTime = new Date(temp)
    startTime.setMinutes(temp.getMinutes() + minStart)
    endTime.setMinutes(temp.getMinutes() + maxEnd)

    item.Start = startTime
    item.End = endTime

    /**
     * if shift starts between 5:00 - 10:00 = opening
     * if shift ends between 8:00 - 11:00 = closing
     */

    const startHours = startTime.getHours()
    const endHours = endTime.getHours()

    if (startHours >= 5 && startHours <= 10) {
      item.emoji = '☀️'
    } else if (endHours >= 20 && endHours <= 23) {
      item.emoji = '🌚'
    }
  }

  return processedSchedule
}
