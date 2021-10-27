// ==UserScript==
// @name         NBC
// @description  Watch videos in external player.
// @version      1.0.7
// @match        *://nbc.com/*
// @match        *://*.nbc.com/*
// @icon         https://www.nbc.com/generetic/favicon.ico
// @run-at       document-end
// @grant        unsafeWindow
// @homepage     https://github.com/warren-bank/crx-NBC/tree/webmonkey-userscript/es5
// @supportURL   https://github.com/warren-bank/crx-NBC/issues
// @downloadURL  https://github.com/warren-bank/crx-NBC/raw/webmonkey-userscript/es5/webmonkey-userscript/NBC.user.js
// @updateURL    https://github.com/warren-bank/crx-NBC/raw/webmonkey-userscript/es5/webmonkey-userscript/NBC.user.js
// @namespace    warren-bank
// @author       Warren Bank
// @copyright    Warren Bank
// ==/UserScript==

// ----------------------------------------------------------------------------- constants

var user_options = {
  "common": {
    "rewrite_show_pages":           true,
    "sort_newest_first":            true
  },
  "webmonkey": {
    "post_intent_redirect_to_url":  "about:blank"
  },
  "greasemonkey": {
    "redirect_to_webcast_reloaded": true,
    "force_http":                   true,
    "force_https":                  false
  }
}

// ----------------------------------------------------------------------------- state

var state = {
  "did_rewrite_dom": false
}

// ----------------------------------------------------------------------------- helpers

var download_text = function(url, headers, data, callback) {
  var xhr    = new unsafeWindow.XMLHttpRequest()
  var method = data ? 'POST' : 'GET'

  xhr.open(method, url, true, null, null)

  if (headers && (typeof headers === 'object')) {
    var keys = Object.keys(headers)
    var key, val
    for (var i=0; i < keys.length; i++) {
      key = keys[i]
      val = headers[key]
      xhr.setRequestHeader(key, val)
    }
  }

  xhr.onload = function(e) {
    if (xhr.readyState === 4) {
      if (xhr.status === 200) {
        callback(xhr.responseText)
      }
    }
  }

  if (data)
    xhr.send(data)
  else
    xhr.send()
}

// -----------------------------------------------------------------------------

/*
 * ======
 * notes:
 * ======
 * - callback is passed an array of objects
 *   * each object represents an episode in the specified season:
 *       {permalink, mpxAccountId, mpxGuid, seasonNumber, episodeNumber, airDate, duration, title, secondaryTitle, longDescription}
 *   * episodes are sorted:
 *       episodeNumber DESC
 */

var download_episodes = function(show_name, season_number, callback) {
  if (!show_name)
    return
  if (!callback || (typeof callback !== 'function'))
    return

  var url, headers, query, variables, data, graphql_callback

  url     = 'https://friendship.nbc.co/v2/graphql'
  headers = {
    "content-type": "application/json",
    "accept":       "application/json"
  }

  /*
   * ===========================
   * ES6 code to generate query:
   * ===========================
  {
    let query = `
      query bonanzaPage(
        $name: String!
        $seasonNumber: Int
        $app: NBCUBrands! = nbc
        $oneApp: Boolean
        $platform: SupportedPlatforms! = web
        $type: EntityPageType! = VIDEO
        $userId: String!
      ) {
        bonanzaPage(
          name: $name
          seasonNumber: $seasonNumber
          app: $app
          oneApp: $oneApp
          platform: $platform
          type: $type
          userId: $userId
        ) {
          data {
            sections {
              ... on LinksSelectableGroup {
                data {
                  items {
                    ... on Stack {
                      data {
                        items {
                          ... on VideoTile {
                            data {
                              locked
                              programmingType
                              permalink
                              mpxAccountId
                              mpxGuid
                              seasonNumber
                              episodeNumber
                              airDate
                              duration
                              title
                              secondaryTitle
                              longDescription
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `
    query = query.replace(/[\r\n\s]+/g, ' ').trim()

    console.log(JSON.stringify(query))
  }
   * ===========================
   */

  query     = 'query bonanzaPage( $name: String! $seasonNumber: Int $app: NBCUBrands! = nbc $oneApp: Boolean $platform: SupportedPlatforms! = web $type: EntityPageType! = VIDEO $userId: String! ) { bonanzaPage( name: $name seasonNumber: $seasonNumber app: $app oneApp: $oneApp platform: $platform type: $type userId: $userId ) { data { sections { ... on LinksSelectableGroup { data { items { ... on Stack { data { items { ... on VideoTile { data { locked programmingType permalink mpxAccountId mpxGuid seasonNumber episodeNumber airDate duration title secondaryTitle longDescription } } } } } } } } } } } }'
  variables = {"name":show_name,"seasonNumber":season_number,"app":"nbc","oneApp":true,"platform":"web","type":"TITLE_V2_EPISODES","userId":"0"}

  if (!season_number)
    delete variables["seasonNumber"]

  data = JSON.stringify({query: query, variables: variables})

  graphql_callback = function(graphql_json) {
    var episodes = []

    try {
      var graphql_data
      var i1, o1, i2, o2, i3, o3

      graphql_data = JSON.parse(graphql_json)

      for (i1=0; i1 < graphql_data.data.bonanzaPage.data.sections.length; i1++) {
        o1 = graphql_data.data.bonanzaPage.data.sections[i1]

        try {
          for (i2=0; i2 < o1.data.items.length; i2++) {
            o2 = o1.data.items[i2]

            try {
              for (i3=0; i3 < o2.data.items.length; i3++) {
                o3 = o2.data.items[i3]

                if (o3 && o3.data && (o3.data.programmingType === 'Full Episode')) {
                  episodes.push(o3.data)
                }
              }
            }
            catch(e3) {}
          }
        }
        catch(e2) {}
      }
    }
    catch(e1) {}

    callback(episodes)
  }

  download_text(url, headers, data, graphql_callback)
}

/*
 * ======
 * debug:
 * ======
  download_episodes("chicago-pd", 0, console.log)  // season 9 (current)
  download_episodes("chicago-pd", 8, console.log)  // season 8
 */

// -----------------------------------------------------------------------------

/*
 * ======
 * notes:
 * ======
 * - callback is passed an array of objects
 *   * each object represents an episode:
 *       {permalink, mpxAccountId, mpxGuid, seasonNumber, episodeNumber, airDate, duration, title, secondaryTitle, longDescription}
 *   * episodes are sorted:
 *       seasonNumber DESC, episodeNumber DESC
 */

var download_all_episodes = function(show_name, callback) {
  var season_number, common_callback, current_season_callback, previous_season_callback
  var all_episodes = []

  common_callback = function(episodes) {
    if (episodes.length) {
      all_episodes = all_episodes.concat(episodes)
    }

    if (isNaN(season_number) || (season_number <= 1)) {
      callback(all_episodes)
    }
    else {
      // next season to download
      season_number--

      download_episodes(show_name, season_number, previous_season_callback)
    }
  }

  current_season_callback = function(episodes) {
    if (episodes.length) {
      // current season
      season_number = parseInt(episodes[0].seasonNumber, 10)
    }

    common_callback(episodes)
  }

  previous_season_callback = common_callback

  download_episodes(show_name, 0, current_season_callback)
}

/*
 * ======
 * debug:
 * ======
  download_all_episodes("chicago-pd", console.log)
 */

// -----------------------------------------------------------------------------

/*
 * ======
 * notes:
 * ======
 * - callback is passed 2x String parameters:
 *   * video_url
 *   * video_type
 */

var download_video_url = function(contentPid, mpxAccountId, mpxGuid, callback) {
  if (!contentPid)
    contentPid = 'NnzsPC'
  if (!mpxAccountId)
    mpxAccountId = '2410887629'
  if (!mpxGuid)
    return
  if (!callback || (typeof callback !== 'function'))
    return

  var url, headers, data, smil_callback

  url     = 'https://link.theplatform.com/s/' + contentPid + '/media/guid/' + mpxAccountId + '/' + mpxGuid + '?format=SMIL&manifest=m3u&Tracking=true&mbr=true'
  headers = null
  data    = null

  smil_callback = function(smil_xml) {
    var regex, matches, video_url, video_type

    regex   = {
      whitespace: /[\r\n\t]+/g,
      smil_xml:   /^.*?\<video\s+src="([^"]+)"[^\>]*?\s+type="([^"]+)".*$/
    }

    smil_xml = smil_xml.replace(regex.whitespace, ' ')

    matches = regex.smil_xml.exec(smil_xml)

    if (matches && matches.length) {
      video_url   = matches[1]
      video_type  = matches[2]

      callback(video_url, video_type)
    }
    else {
      callback(null, null)
    }
  }

  download_text(url, headers, data, smil_callback)
}

/*
 * ======
 * debug:
 * ======
  download_video_url(null, null, "9000091020", console.log)
 */

// ----------------------------------------------------------------------------- URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url = function(video_url, caption_url, referer_url, force_http, force_https) {
  force_http  = (typeof force_http  === 'boolean') ? force_http  : user_options.greasemonkey.force_http
  force_https = (typeof force_https === 'boolean') ? force_https : user_options.greasemonkey.force_https

  var encoded_video_url, encoded_caption_url, encoded_referer_url, webcast_reloaded_base, webcast_reloaded_url

  encoded_video_url     = encodeURIComponent(encodeURIComponent(btoa(video_url)))
  encoded_caption_url   = caption_url ? encodeURIComponent(encodeURIComponent(btoa(caption_url))) : null
  referer_url           = referer_url ? referer_url : unsafeWindow.location.href
  encoded_referer_url   = encodeURIComponent(encodeURIComponent(btoa(referer_url)))

  webcast_reloaded_base = {
    "https": "https://warren-bank.github.io/crx-webcast-reloaded/external_website/index.html",
    "http":  "http://webcast-reloaded.surge.sh/index.html"
  }

  webcast_reloaded_base = (force_http)
                            ? webcast_reloaded_base.http
                            : (force_https)
                               ? webcast_reloaded_base.https
                               : (video_url.toLowerCase().indexOf('http:') === 0)
                                  ? webcast_reloaded_base.http
                                  : webcast_reloaded_base.https

  webcast_reloaded_url  = webcast_reloaded_base + '#/watch/' + encoded_video_url + (encoded_caption_url ? ('/subtitle/' + encoded_caption_url) : '') + '/referer/' + encoded_referer_url
  return webcast_reloaded_url
}

// ----------------------------------------------------------------------------- URL redirect

var redirect_to_url = function(url) {
  if (!url) return

  if (typeof GM_loadUrl === 'function') {
    if (typeof GM_resolveUrl === 'function')
      url = GM_resolveUrl(url, unsafeWindow.location.href) || url

    GM_loadUrl(url, 'Referer', unsafeWindow.location.href)
  }
  else {
    try {
      unsafeWindow.top.location = url
    }
    catch(e) {
      unsafeWindow.window.location = url
    }
  }
}

var process_webmonkey_post_intent_redirect_to_url = function() {
  var url = null

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'string')
    url = user_options.webmonkey.post_intent_redirect_to_url

  if (typeof user_options.webmonkey.post_intent_redirect_to_url === 'function')
    url = user_options.webmonkey.post_intent_redirect_to_url()

  if (typeof url === 'string')
    redirect_to_url(url)
}

var process_video_data = function(data) {
  if (!data.video_url) return

  if (!data.referer_url)
    data.referer_url = unsafeWindow.location.href

  if (typeof GM_startIntent === 'function') {
    // running in Android-WebMonkey: open Intent chooser

    var args = [
      /* action = */ 'android.intent.action.VIEW',
      /* data   = */ data.video_url,
      /* type   = */ data.video_type
    ]

    // extras:
    if (data.caption_url) {
      args.push('textUrl')
      args.push(data.caption_url)
    }
    if (data.referer_url) {
      args.push('referUrl')
      args.push(data.referer_url)
    }
    if (data.drm.scheme) {
      args.push('drmScheme')
      args.push(data.drm.scheme)
    }
    if (data.drm.server) {
      args.push('drmUrl')
      args.push(data.drm.server)
    }
    if (data.drm.headers && (typeof data.drm.headers === 'object')) {
      var drm_header_keys, drm_header_key, drm_header_val

      drm_header_keys = Object.keys(data.drm.headers)
      for (var i=0; i < drm_header_keys.length; i++) {
        drm_header_key = drm_header_keys[i]
        drm_header_val = data.drm.headers[drm_header_key]

        args.push('drmHeader')
        args.push(drm_header_key + ': ' + drm_header_val)
      }
    }

    GM_startIntent.apply(this, args)
    process_webmonkey_post_intent_redirect_to_url()
    return true
  }
  else if (user_options.greasemonkey.redirect_to_webcast_reloaded) {
    // running in standard web browser: redirect URL to top-level tool on Webcast Reloaded website

    redirect_to_url(get_webcast_reloaded_url(data.video_url, data.caption_url, data.referer_url))
    return true
  }
  else {
    return false
  }
}

// -------------------------------------

var process_hls_data = function(data) {
  data.video_type = 'application/x-mpegurl'
  process_video_data(data)
}

var process_dash_data = function(data) {
  data.video_type = 'application/dash+xml'
  process_video_data(data)
}

// -------------------------------------

var process_video_url = function(video_url, video_type, caption_url, referer_url) {
  var data = {
    drm: {
      scheme:    null,
      server:    null,
      headers:   null
    },
    video_url:   video_url   || null,
    video_type:  video_type  || null,
    caption_url: caption_url || null,
    referer_url: referer_url || null
  }

  process_video_data(data)
}

var process_hls_url = function(video_url, caption_url, referer_url) {
  process_video_url(video_url, /* video_type= */ 'application/x-mpegurl', caption_url, referer_url)
}

var process_dash_url = function(video_url, caption_url, referer_url) {
  process_video_url(video_url, /* video_type= */ 'application/dash+xml', caption_url, referer_url)
}

// ----------------------------------------------------------------------------- process video

// ------------------------------------- helper:

var inspect_video_dom = function() {
  var regex, scripts, script, matches, contentPid, mpxAccountId

  regex = {
    contentPid:   /,\s*contentPid:\s*"([^"]+)"/,
    mpxAccountId: /"mpxAccountId":\s*"([^"]+)"/
  }

  scripts = unsafeWindow.document.querySelectorAll('script:not([src])')
  for (var i=0; i < scripts.length; i++) {
    script = scripts[i]
    script = script.innerText

    if (!contentPid) {
      matches = regex.contentPid.exec(script)
      if (matches && matches.length) {
        contentPid = matches[1]
      }
    }

    if (!mpxAccountId) {
      matches = regex.mpxAccountId.exec(script)
      if (matches && matches.length) {
        mpxAccountId = matches[1]
      }
    }

    if (contentPid && mpxAccountId) break
  }

  return {contentPid: contentPid, mpxAccountId: mpxAccountId}
}

// -------------------------------------

var process_video = function(contentPid, mpxAccountId, mpxGuid) {
  download_video_url(contentPid, mpxAccountId, mpxGuid, process_video_url)
}

// ----------------------------------------------------------------------------- rewrite DOM to display all available full-episodes for show

// ------------------------------------- constants

var strings = {
  "button_download_video":          "Get Video URL",
  "button_start_video":             "Start Video",
  "button_unavailable_video":       "Video Is Not Available",
  "episode_labels": {
    "title":                        "title:",
    "episode":                      "episode:",
    "date_release":                 "date:",
    "time_duration":                "duration:",
    "summary":                      "summary:"
  },
  "episode_units": {
    "duration_hour":                "hour",
    "duration_hours":               "hours",
    "duration_minutes":             "minutes"
  }
}

var constants = {
  "dom_classes": {
    "div_episodes":                 "episodes",
    "div_webcast_icons":            "icons-container"
  },
  "img_urls": {
    "icon_lock":                    "https://github.com/warren-bank/crx-NBC/raw/webmonkey-userscript/es5/webmonkey-userscript/img/black.lock.outline.png",
    "base_webcast_reloaded_icons":  "https://github.com/warren-bank/crx-webcast-reloaded/raw/gh-pages/chrome_extension/2-release/popup/img/"
  }
}

// -------------------------------------  helpers

var repeat_string = function(str, count) {
  var rep = ''
  for (var i=0; i < count; i++)
    rep += str
  return rep
}

var pad_zeros = function(num, len) {
  var str = num.toString()
  var pad = len - str.length
  if (pad > 0)
    str = repeat_string('0', pad) + str
  return str
}

// -------------------------------------  URL links to tools on Webcast Reloaded website

var get_webcast_reloaded_url_chromecast_sender = function(video_url, caption_url, referer_url) {
  return get_webcast_reloaded_url(video_url, caption_url, referer_url, /* force_http= */ null, /* force_https= */ null).replace('/index.html', '/chromecast_sender.html')
}

var get_webcast_reloaded_url_airplay_sender = function(video_url, caption_url, referer_url) {
  return get_webcast_reloaded_url(video_url, caption_url, referer_url, /* force_http= */ true, /* force_https= */ false).replace('/index.html', '/airplay_sender.es5.html')
}

var get_webcast_reloaded_url_proxy = function(hls_url, caption_url, referer_url) {
  return get_webcast_reloaded_url(hls_url, caption_url, referer_url, /* force_http= */ true, /* force_https= */ false).replace('/index.html', '/proxy.html')
}

// -------------------------------------  DOM: static skeleton

var reinitialize_dom = function() {
  var head = unsafeWindow.document.getElementsByTagName('head')[0]
  var body = unsafeWindow.document.body

  var html = {
    "head": [
      '<style>',

      // --------------------------------------------------- CSS: global

      'body {',
      '  background-color: #fff;',
      '  text-align: left;',
      '}',

      // --------------------------------------------------- CSS: episodes

      'div.' + constants.dom_classes.div_episodes + ' > ul {',
      '  list-style: none;',
      '  margin: 0;',
      '  padding: 0;',
      '  padding-left: 1em;',
      '}',

      'div.' + constants.dom_classes.div_episodes + ' > ul > li {',
      '  list-style: none;',
      '  margin-top: 0.5em;',
      '  border-top: 1px solid #999;',
      '  padding-top: 0.5em;',
      '}',

      'div.' + constants.dom_classes.div_episodes + ' > ul > li > table {',
      '  min-height: 70px;',
      '}',

      'div.' + constants.dom_classes.div_episodes + ' > ul > li > table td:first-child {',
      '  font-style: italic;',
      '  padding-right: 1em;',
      '}',

      'div.' + constants.dom_classes.div_episodes + ' > ul > li > table td > div.locked {',
      '  display: inline-block;',
      '  width:  1em;',
      '  height: 1em;',
      '  margin-right: 0.5em;',
      '  background-image: url("' + constants.img_urls.icon_lock + '");',
      '  background-repeat: no-repeat;',
      '  background-size: 100% 100%;',
      '}',

      'div.' + constants.dom_classes.div_episodes + ' > ul > li > table td > a {',
      '  display: inline-block;',
      '  margin: 0;',
      '  color: blue;',
      '  text-decoration: none;',
      '}',

      'div.' + constants.dom_classes.div_episodes + ' > ul > li > blockquote {',
      '  display: block;',
      '  background-color: #eee;',
      '  padding: 0.5em 1em;',
      '  margin: 0;',
      '}',

      'div.' + constants.dom_classes.div_episodes + ' > ul > li > button {',
      '  margin: 0.75em 0;',
      '}',

      'div.' + constants.dom_classes.div_episodes + ' > ul > li > div.' + constants.dom_classes.div_webcast_icons + ' {',
      '}',

      // --------------------------------------------------- CSS: EPG data (links to tools on Webcast Reloaded website)

      'div.' + constants.dom_classes.div_webcast_icons + ' {',
      '  display: block;',
      '  position: relative;',
      '  z-index: 1;',
      '  float: right;',
      '  margin: 0.5em;',
      '  width: 60px;',
      '  height: 60px;',
      '  max-height: 60px;',
      '  vertical-align: top;',
      '  background-color: #d7ecf5;',
      '  border: 1px solid #000;',
      '  border-radius: 14px;',
      '}',

      'div.' + constants.dom_classes.div_webcast_icons + ' > a.chromecast,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.chromecast > img,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.airplay,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.airplay > img,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.proxy,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.proxy > img,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.video-link,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.video-link > img {',
      '  display: block;',
      '  width: 25px;',
      '  height: 25px;',
      '}',

      'div.' + constants.dom_classes.div_webcast_icons + ' > a.chromecast,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.airplay,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.proxy,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.video-link {',
      '  position: absolute;',
      '  z-index: 1;',
      '  text-decoration: none;',
      '}',

      'div.' + constants.dom_classes.div_webcast_icons + ' > a.chromecast,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.airplay {',
      '  top: 0;',
      '}',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.proxy,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.video-link {',
      '  bottom: 0;',
      '}',

      'div.' + constants.dom_classes.div_webcast_icons + ' > a.chromecast,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.proxy {',
      '  left: 0;',
      '}',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.airplay,',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.video-link {',
      '  right: 0;',
      '}',
      'div.' + constants.dom_classes.div_webcast_icons + ' > a.airplay + a.video-link {',
      '  right: 17px; /* (60 - 25)/2 to center when there is no proxy icon */',
      '}',

      '</style>'
    ],
    "body": [
      '<div class="' + constants.dom_classes.div_episodes + '"></div>'
    ]
  }

  head.innerHTML = '' + html.head.join("\n")
  body.innerHTML = '' + html.body.join("\n")
}

// ------------------------------------- DOM: dynamic elements - common

var make_element = function(elementName, html) {
  var el = unsafeWindow.document.createElement(elementName)

  if (html)
    el.innerHTML = html

  return el
}

var make_span = function(text) {return make_element('span', text)}
var make_h4   = function(text) {return make_element('h4',   text)}

// ------------------------------------- DOM: dynamic elements - episodes

var make_webcast_reloaded_div = function(video_url, caption_url, referer_url) {
  var webcast_reloaded_urls = {
//  "index":             get_webcast_reloaded_url(                  video_url, caption_url, referer_url),
    "chromecast_sender": get_webcast_reloaded_url_chromecast_sender(video_url, caption_url, referer_url),
    "airplay_sender":    get_webcast_reloaded_url_airplay_sender(   video_url, caption_url, referer_url),
    "proxy":             get_webcast_reloaded_url_proxy(            video_url, caption_url, referer_url)
  }

  var div = make_element('div')

  var html = [
    '<a target="_blank" class="chromecast" href="' + webcast_reloaded_urls.chromecast_sender + '" title="Chromecast Sender"><img src="'       + constants.img_urls.base_webcast_reloaded_icons + 'chromecast.png"></a>',
    '<a target="_blank" class="airplay" href="'    + webcast_reloaded_urls.airplay_sender    + '" title="ExoAirPlayer Sender"><img src="'     + constants.img_urls.base_webcast_reloaded_icons + 'airplay.png"></a>',
    '<a target="_blank" class="proxy" href="'      + webcast_reloaded_urls.proxy             + '" title="HLS-Proxy Configuration"><img src="' + constants.img_urls.base_webcast_reloaded_icons + 'proxy.png"></a>',
    '<a target="_blank" class="video-link" href="' + video_url                                 + '" title="direct link to video"><img src="'    + constants.img_urls.base_webcast_reloaded_icons + 'video_link.png"></a>'
  ]

  div.setAttribute('class', constants.dom_classes.div_webcast_icons)
  div.innerHTML = html.join("\n")

  return div
}

var insert_webcast_reloaded_div = function(block_element, video_url, caption_url, referer_url) {
  var webcast_reloaded_div = make_webcast_reloaded_div(video_url, caption_url, referer_url)

  if (block_element.childNodes.length)
    block_element.insertBefore(webcast_reloaded_div, block_element.childNodes[0])
  else
    block_element.appendChild(webcast_reloaded_div)
}

var download_video = function(contentPid, mpxAccountId, mpxGuid, block_element, old_button) {
  var callback = function(video_url, video_type) {
    if (video_url) {
      insert_webcast_reloaded_div(block_element, video_url)
      add_start_video_button(video_url, video_type, /* caption_url= */ null, block_element, old_button)
    }
    else {
      old_button.innerHTML = strings.button_unavailable_video
      old_button.disabled  = true
    }
  }

  download_video_url(contentPid, mpxAccountId, mpxGuid, callback)
}

// -------------------------------------

var onclick_start_video_button = function(event) {
  event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=true;

  var button      = event.target
  var video_url   = button.getAttribute('x-video-url')
  var video_type  = button.getAttribute('x-video-type')
  var caption_url = button.getAttribute('x-caption-url')

  if (video_url)
    process_video_url(video_url, video_type, caption_url)
}

var make_start_video_button = function(video_url, video_type, caption_url) {
  var button = make_element('button')

  button.setAttribute('x-video-url',   video_url)
  button.setAttribute('x-video-type',  video_type)
  button.setAttribute('x-caption-url', caption_url)
  button.innerHTML = strings.button_start_video
  button.addEventListener("click", onclick_start_video_button)

  return button
}

var add_start_video_button = function(video_url, video_type, caption_url, block_element, old_button) {
  var new_button = make_start_video_button(video_url, video_type, caption_url)

  if (old_button)
    old_button.parentNode.replaceChild(new_button, old_button)
  else
    block_element.appendChild(new_button)
}

// -------------------------------------

var convert_ms_to_mins = function(X) {
  // (X ms)(1 sec / 1000 ms)(1 min / 60 sec)
  return Math.ceil(X / 60000)
}

var get_ms_duration_time_string = function(ms) {
  var time_string = ''
  var mins = convert_ms_to_mins(ms)
  var hours

  if (mins >= 60) {
    hours       = Math.floor(mins / 60)
    time_string = hours + ' ' + ((hours < 2) ? strings.episode_units.duration_hour : strings.episode_units.duration_hours) + ', '
    mins        = mins % 60
  }

  return time_string + mins + ' ' + strings.episode_units.duration_minutes
}

var make_episode_listitem_html = function(video) {
  if (video.duration)
    video.duration = get_ms_duration_time_string(video.duration)

  var tr = []

  var append_tr = function(td, colspan) {
    if (Array.isArray(td))
      tr.push('<tr><td>' + td.join('</td><td>') + '</td></tr>')
    else if ((typeof colspan === 'number') && (colspan > 1))
      tr.push('<tr><td colspan="' + colspan + '">' + td + '</td></tr>')
    else
      tr.push('<tr><td>' + td + '</td></tr>')
  }

  if (video.title && video.url)
    video.title = '<a target="_blank" href="' + video.url + '">' + video.title + '</a>'
  if (video.locked)
    video.title = '<div class="locked"></div>' + video.title
  if (video.title)
    append_tr([strings.episode_labels.title, video.title])
  if (video.season && video.episode)
    append_tr([strings.episode_labels.episode, ('S' + pad_zeros(video.season, 2) + ' E' + pad_zeros(video.episode, 2))])
  if (video.date)
    append_tr([strings.episode_labels.date_release, video.date])
  if (video.duration)
    append_tr([strings.episode_labels.time_duration, video.duration])
  if (video.description)
    append_tr(strings.episode_labels.summary, 2)

  var html = ['<table>' + tr.join("\n") + '</table>']
  if (video.description)
    html.push('<blockquote>' + video.description + '</blockquote>')

  return '<li x-mpx-account-id="' + video.mpxAccountId + '" x-mpx-guid="' + video.mpxGuid + '">' + html.join("\n") + '</li>'
}

// -------------------------------------

var onclick_download_show_video_button = function(event) {
  event.stopPropagation();event.stopImmediatePropagation();event.preventDefault();event.returnValue=true;

  var button, mpxAccountId, mpxGuid, episodes_div, episode_item

  button = event.target

  mpxAccountId = button.getAttribute('x-mpx-account-id')
  mpxGuid      = button.getAttribute('x-mpx-guid')

  if (!mpxGuid) return

  episodes_div = unsafeWindow.document.querySelector('div.' + constants.dom_classes.div_episodes)
  if (!episodes_div) return

  episode_item = episodes_div.querySelector('li[x-mpx-account-id="' + mpxAccountId + '"][x-mpx-guid="' + mpxGuid + '"]')
  if (!episode_item) return

  download_video(/* contentPid= */ null, mpxAccountId, mpxGuid, /* block_element= */ episode_item, /* old_button= */ button)
}

var make_download_show_video_button = function(mpxAccountId, mpxGuid) {
  var button = make_element('button')

  button.setAttribute('x-mpx-account-id', mpxAccountId)
  button.setAttribute('x-mpx-guid',       mpxGuid)
  button.innerHTML = strings.button_download_video
  button.addEventListener("click", onclick_download_show_video_button)

  return button
}

var add_episode_div_buttons = function(episodes_div) {
  var episode_items = episodes_div.querySelectorAll('li[x-mpx-account-id][x-mpx-guid]')
  var episode_item, mpxAccountId, mpxGuid, button

  for (var i=0; i < episode_items.length; i++) {
    episode_item = episode_items[i]

    mpxAccountId = episode_item.getAttribute('x-mpx-account-id')
    mpxGuid      = episode_item.getAttribute('x-mpx-guid')

    if (!mpxGuid) continue

    button = make_download_show_video_button(mpxAccountId, mpxGuid)
    episode_item.appendChild(button)
  }
}

// -------------------------------------

var display_episodes = function(episodes) {
  var episodes_div, html

  reinitialize_dom()

  episodes_div = unsafeWindow.document.querySelector('div.' + constants.dom_classes.div_episodes)
  if (!episodes_div) return

  html = '<ul>' + episodes.map(make_episode_listitem_html).join("\n") + '</ul>'
  episodes_div.innerHTML = html

  add_episode_div_buttons(episodes_div)

  state.did_rewrite_dom = true
}

// -------------------------------------

var process_episodes = function(episodes) {
  if (!episodes || !episodes.length) return

  if (episodes.length === 1) {
    process_video(/* contentPid= */ null, episodes[0].mpxAccountId, episodes[0].mpxGuid)
    return
  }

  // optionally: sort episodes in ascending chronological order
  if (!user_options.common.sort_newest_first) {
    episodes.reverse()
  }

  // rename video attributes
  episodes = episodes.map(function(video) {
    return {
      mpxAccountId: video.mpxAccountId,
      mpxGuid:      video.mpxGuid,
      locked:       video.locked,
      url:          video.permalink,
      season:       (video.seasonNumber  ? parseInt(video.seasonNumber,  10)              : 0),
      episode:      (video.episodeNumber ? parseInt(video.episodeNumber, 10)              : 0),
      date:         (video.airDate       ? (new Date(video.airDate)).toLocaleDateString() : null),
      duration:     (video.duration      ? (video.duration * 1000)                        : 0),
      title:        [video.title, video.secondaryTitle].join(' | '),
      description:  video.longDescription
    }
  })

  display_episodes(episodes)
}

var rewrite_show_page = function(show_name, season_number) {
  if (!user_options.common.rewrite_show_pages) return

  // season 0: only downloads the most recent season
  if ((typeof season_number === 'number') && (season_number >= 0))
    download_episodes(show_name, season_number, process_episodes)
  else
    download_all_episodes(show_name, process_episodes)
}

// ----------------------------------------------------------------------------- bootstrap

/*
 * ======
 * notes:
 * ======
 * - return value is a wrapper function
 */

var trigger_on_function_call = function(func, func_this, trigger) {
  if (typeof trigger !== 'function') return func

  return function() {
    func.apply((func_this || null), arguments)

    trigger()
  }
}

var wrap_history_state_mutations = function() {
  if (unsafeWindow.history && (typeof unsafeWindow.history.pushState === 'function'))
    unsafeWindow.history.pushState = trigger_on_function_call(unsafeWindow.history.pushState, unsafeWindow.history, init)

  if (unsafeWindow.history && (typeof unsafeWindow.history.replaceState === 'function'))
    unsafeWindow.history.replaceState = trigger_on_function_call(unsafeWindow.history.replaceState, unsafeWindow.history, init)

  unsafeWindow.onpopstate = function() {
    if (state.did_rewrite_dom)
      unsafeWindow.location.reload()
  }

  if (unsafeWindow.history && (typeof unsafeWindow.history.back === 'function'))
    unsafeWindow.history.back = trigger_on_function_call(unsafeWindow.history.back, unsafeWindow.history, unsafeWindow.onpopstate)
}

// -------------------------------------

var init = function() {
  var regex, pathname, matches
  var mpxGuid, show_name, season_number

  regex = {
    is_video: new RegExp('^/(?:[^/]+)/video/(?:[^/]+)/(\\d+)/?$'),
    is_show:  new RegExp('^/([^/]+)/episodes(?:/season-(\\d+))?/?$')
  }

  pathname = unsafeWindow.location.pathname

  matches = regex.is_video.exec(pathname)
  if (matches && matches.length) {
    mpxGuid = matches[1]

    matches = inspect_video_dom()

    process_video(matches.contentPid, matches.mpxAccountId, mpxGuid)
    return
  }

  matches = regex.is_show.exec(pathname)
  if (matches && matches.length) {
    show_name     = matches[1]
    season_number = matches[2]

    if (season_number)
      season_number = parseInt(season_number, 10)

    rewrite_show_page(show_name, season_number)
    return
  }
}

init()
wrap_history_state_mutations()

// -----------------------------------------------------------------------------
