const express = require('express')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const {open} = require('sqlite')
const sqlite3 = require('sqlite3')

const app = express()
app.use(express.json())

const dbPath = path.join(__dirname, 'covid19IndiaPortal.db')

let db = null

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running at 3000 port')
    })
  } catch (e) {
    console.log(`DB Error '${e.message}'`)
    process.exit(1)
  }
}

initializeDBAndServer()
//Authentication with Token

const authorizationToken = (request, response, next) => {
  let jwtToken
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'secert_Token', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.username = payload.username
        next()
      }
    })
  }
}

//API 1 username and password

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`
  const dbUser = await db.get(selectUserQuery)
  if (dbUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordMatch = await bcrypt.compare(password, dbUser.password)
    if (isPasswordMatch === true) {
      const payload = {
        username: username,
      }
      const jwtToken = jwt.sign(payload, 'secert_Token')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

const convertStateDbObjectToResponseDbObject = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictDbObjectToResponseDbObject = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

//API 2

app.get('/states/', authorizationToken, async (request, response) => {
  const getStateQuery = `
    SELECT * FROM state;
    `
  const stateArray = await db.all(getStateQuery)
  response.send(
    stateArray.map(eachState =>
      convertStateDbObjectToResponseDbObject(eachState),
    ),
  )
})

app.get('/states/:stateId/', authorizationToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `
  SELECT * FROM state WHERE state_id = ${stateId};
  `
  const state = await db.get(getStateQuery)
  // console.log(state)
  response.send(convertStateDbObjectToResponseDbObject(state))
})

//API 4
app.post('/districts/', authorizationToken, async (request, response) => {
  const {districtId} = request.params
  const {districtName, stateId, cases, cured, active, deaths} = request.body
  const postDistrictQuery = `
  INSERT INTO 
  district (district_name, state_id, cases, cured, active, deaths)
  VALUES 
  (
    '${districtName}',
    '${stateId}',
    '${cases}',
    '${cured}',
    '${active}',
    '${deaths}'
  );
  `
  await db.run(postDistrictQuery)
  response.send('District Successfully Added')
})

//API 5
app.get(
  '/districts/:districtId/',
  authorizationToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `
  SELECT * FROM district WHERE district_id = '${districtId}';
  `
    const district = await db.get(getDistrictQuery)
    response.send(convertDistrictDbObjectToResponseDbObject(district))
  },
)

//API 6
app.delete(
  '/districts/:districtId/',
  authorizationToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `
  DELETE FROM district WHERE district_id = '${districtId}'
  `
    await db.run(deleteDistrictQuery)
    response.send('District Removed')
  },
)

//API 7

app.put(
  '/districts/:districtId/',
  authorizationToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const putDistrictQuery = `
  UPDATE  
  district 
  SET
  district_name= '${districtName}', 
  state_id = '${stateId}',
  cases='${cases}',
  cured='${cured}', 
  active='${active}', 
  deaths = '${deaths}';
  `
    await db.run(putDistrictQuery)
    response.send('District Details Updated')
  },
)

//API 8
app.get(
  '/states/:stateId/stats/',
  authorizationToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatsQuery = `
  SELECT
    SUM(cases) as totalCases,
    SUM(cured) as totalCured,
    SUM(active) as totalActive,
    SUM(deaths) as totalDeaths
  FROM 
    district
  WHERE 
  state_id = '${stateId}';
  `
    const stats = await db.get(getStatsQuery)
    response.send(stats)
  },
)

module.exports = app
