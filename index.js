/**
 * @Author: YzzTing
 * @Date: 2023/8/29 12:14
 */
const BASEURL = 'http://api.interpreter.caiyunai.com/v1'
const TOKEN = tjs.getenv('Token')

const pipe = (...functions) => input => functions.reduce((acc, fn) => fn(acc), input)
const containsChinese = word => /^[\u4e00-\u9fa5]+$/.test(word)
const extractNonDigits = word => word.replace(/\d+/g, '')
const pipeline = pipe(extractNonDigits, containsChinese)

const postData = (path, data) => {
  return fetch(`${BASEURL}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-authorization': `token:${TOKEN}`,
    },
    body: JSON.stringify(data)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return response.json()
    })
    .catch(error => {
      console.error('There was a problem with the fetch operation: ', error)
      throw error
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
          title: errorObj[code] || `查询失败, 请检查网络`,
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
          dictionaryResult.dictionary.explanations?.forEach((item) => {
            this._result.items.push({
              title: item,
              arg: item,
            })
          })
          dictionaryResult.dictionary.wqx_example?.forEach((item) => {
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

const source = Array.from(tjs.args).pop()
const translate = new Translate(source)

translate.query()
  .then(r => console.log(JSON.stringify(r)))
  .catch(e => console.log(JSON.stringify(e)))
