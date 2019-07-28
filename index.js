const express = require("express")
const https = require("https")
const exit = require('exit')

require('dotenv').config()

const apiHostname = "getpocket.com"
const hostname = 'localhost'
const servPort = process.env.SERVER_PORT
const consumerKey = process.env.POCKET_CONSUMER_KEY

if(!servPort || Number.isNaN(parseInt(servPort, 10))){
  throw new Error(`invalid port number: ${servPort}`)
}
if(!consumerKey){
  throw new Error('require pocket consumer key')
}

const headers = {
  "Content-Type": "application/json; charset=UTF8",
  'X-Accept': "application/json"
}

const redirectUrl = `http://${hostname}:${servPort}`

/**
 * @return {Promise<{code: string}>}
 */
const fetchRequestToken = () => {
  let responseData = ""
  return new Promise((resolve,reject) => {
    const req = https.request(`https://${apiHostname}/v3/oauth/request`,{
      method:"POST",
      headers
    }, res => {
      if(res.statusCode!==200){
        const err = new Error(`Failed: code ${res.statusCode}`)
        reject(err)
        throw err
      }
      res.setEncoding('utf8')
      res.on('data', data => {
        responseData+=data
      })
      res.on('end', () =>{
        try{
          resolve(JSON.parse(responseData))
        }catch(e){
          reject(new Error(`failed parse response json: ${responseData}`))
        }
      })
    })

    req.write(JSON.stringify({
      "consumer_key": consumerKey,
      "redirect_uri": redirectUrl
    }))
    req.end()
  })
}


/**
 *
 * @param {string} requestToken
 * @return {Promise<{access_token: string, username: string}>}
 */
const fetchSecretToken = (requestToken) => {
  return new Promise((resolve,reject)=>{
    let resData = ""
    const req = https.request(`https://${apiHostname}/v3/oauth/authorize`,{
      method:"POST",
      headers
    }, res => {
      if(res.statusCode!==200){
        console.log(res.headers)
        const err = new Error('failed request: code ' + res.statusCode)
        reject(err)
        throw err
      }
      console.log({statusCode: res.statusCode})
      res.setEncoding('utf8')
      res.on('data', d => {
        resData += d
      })
      res.on('end', () => {
        resolve(JSON.parse(resData))
      })
    })
    req.write(JSON.stringify({
      "consumer_key": consumerKey,
      code: requestToken,
    }))
    req.end()
  })
}

const genRedirectUrl = reqToken => {
      return `https://getpocket.com/auth/authorize?request_token=${reqToken}&redirect_uri=` + encodeURIComponent(redirectUrl)
}

;(async () => {

  let reqToken = ""

  const app = express()
  app.get('/', async (req,res) =>{
    res.set({
      'Cache-Control': 'no-store'
    })
    if(reqToken.length){
      const {access_token, username} = await fetchSecretToken(reqToken)
      console.log({access_token, username})
      res.send({access_token, username})
      console.log('DONE')
      exit(0)
    }else{
      res.send('alive')
    }
  })

  app.listen(servPort, 'localhost')

  const {code} = await fetchRequestToken()
  console.log({requestToke: code})
  reqToken = code

  const url = genRedirectUrl(reqToken)
  console.log(`authenticationUrl: ${url}`)
})()