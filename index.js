/**
 * @Author: YzzTing
 * @Date: 2023/8/29 12:14
 */
const http = require('http')

const BASEURL = 'api.interpreter.caiyunai.com'
const TOKEN = process.env.Token

const pipe = (...functions) => input => functions.reduce((acc, fn) => fn(acc), input)
const containsChinese = word => /^[\u4e00-\u9fa5]+$/.test(word)
const extractNonDigits = word => word.replace(/\d+/g, '')
const pipeline = pipe(extractNonDigits, containsChinese)

const postData = (path, data) => {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASEURL,
      port: 80,
      path: `/v1/${path}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-authorization': `token:${TOKEN}`,
      },
    }

    const req = http.request(options, (res) => {
      let responseData = ''
      res.on('data', (chunk) => {
        responseData += chunk
      })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(`${res.statusCode}`)
        } else {
          try {
            resolve(JSON.parse(responseData))
          } catch (e) {
            reject(102)
          }
        }
      })
    })

    req.on('error', (error) => {
      reject('http error', error)
    })

    req.write(JSON.stringify(data))
    req.end()
  })
}

class Translate {
  _source = []

  _result = {
    items: [],
  }

  constructor(source) {
    this._source = source
  }

  _handleError(code) {
    const errorObj = {
      101: '翻译出错了...',
      102: '解析数据出错了...',
      401: '查询失败, 请Token是否正确...',
      404: '查询失败, 请检查网络...',
    }
    return {
      items: [
        {
          title: errorObj[code] || '查询失败, 请检查网络',
        }
      ]
    }
  }

  _queryTranslate() {
    const containsChineseFlag = pipeline(this._source)
    const payload = {
      source: this._source,
      trans_type: `${containsChineseFlag ? 'zh2en' : 'auto2zh'}`,
      detect: true,
    }
    return postData('translator', payload)
  }

  _queryDictionary() {
    const containsChineseFlag = pipeline(this._source)
    const payload = {
      source: this._source,
      trans_type: `${containsChineseFlag ? 'zh2en' : 'en2zh'}`,
      detect: true,
    }
    return postData('dict', payload)
  }

  query() {
    if (typeof this._source !== 'string' || this._source.trim() === '') {
      return Promise.reject(this._handleError(101))
    }
    return Promise.all([this._queryTranslate(), this._queryDictionary()])
      .then(([translateResult, dictionaryResult]) => {
        if (translateResult.message) {
          this._result.items.push({
            title: translateResult.message,
            arg: translateResult.message,
          })
        }
        if (translateResult.target) {
          this._result.items.push({
            title: translateResult.target,
            arg: translateResult.target
          })
        }

        if (dictionaryResult.dictionary && Object.keys(dictionaryResult.dictionary).length) {
          dictionaryResult.dictionary.explanations.forEach((item) => {
            this._result.items.push({
              title: item,
              arg: item,
            })
          })
          dictionaryResult.dictionary.wqx_example.forEach((item) => {
            this._result.items.push({
              title: item[1],
              subtitle: item[0],
              arg: item.join(','),
            })
          })
        }

        if (!this._result.items.length) {
          this._result.items.push({
            title: '未查询到结果',
            arg: '未查询到结果',
          })
        }
        return this._result
      })
      .catch((error) => {
        return this._handleError(error)
      })
  }
}

const source = Array.from(process.argv).pop()
const translate = new Translate(source)

translate.query()
  .then(r => console.log(JSON.stringify(r)))
  .catch(e => console.log(JSON.stringify(e)))
