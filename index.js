import axios from 'axios';

const loginRes = await axios({
  url: 'https://sf.lush.com/storeforce/ess/services/FoundationService.svc/Login',
  method: 'POST',
  data: {
    username: '',
    password: '',
    culture: 'en-US'
  }
})

const login = JSON.parse(loginRes.data)

console.log(login)

const scheduleRed = await axios({
  url: 'https://sf.lush.com/storeforce/ess/services/ScheduleService.svc/GetMonthlySchedule',
  method: 'POST',
  data: {
    session: login.Session,
    datestring: '"2023-10-16T00:00:00"',
    culture: "en-US"
  }
})

const schedule = JSON.parse(scheduleRed.data)
const processedSchedule = []

for (const item of schedule) {
  // Check to see if `LocalDate` entry exists
  const index = processedSchedule.findIndex(x => x.LocalDate === item.LocalDate)

  if (index > -1) {
    processedSchedule[index].events.push(item)
  } else {
    processedSchedule.push({
      LocalDate: item.LocalDate,
      events: [item]
    })
  }
}

for (const item of processedSchedule) {
  // Set start and end times
  let minStart = Infinity;
  let maxEnd = 0;

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
}

console.log(processedSchedule)
