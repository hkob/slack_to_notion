// ver 0.2: add page when the reaction is the first one.
// ver 0.1: first release

function storeTokenAndIds() {
  const scriptProperties = PropertiesService.getScriptProperties()
  scriptProperties.setProperties({
    "MY_NOTION_TOKEN": "@@@ Paste your Integration token @@@",
    "DATABASE_ID": "@@@ Paste your database_id like as 771391e755c245b2a31290f40f187ab9 @@@",
    "VERIFICATION_TOKEN": "@@@ Paste your verification token in Sec.10 @@@@",
    "BOT_USER_OAUTH_TOKEN": "@@@ Paste your Bot User OAuth Token in Sec. 10 @@@"
  })
  // Confirm that the above registration was successful
  console.log("myNotionToken = " + myNotionToken())
  console.log("databaseId = " + databaseId())
  console.log("verificationToken = " + verificationToken())
  console.log("Bot User OAuth Token = " + botUserOAuthToken())
}

function testCreateNotionPage() {
  const message = "Test title\n<https://www.google.com/>"
  const userDisplayName = "test user"
  const channelName = "test channel"
  createPage(createPayloadOnlyProperties(message, userDisplayName, channelName))
}

function outputSheet(str, cell) {
  const sheet = SpreadsheetApp.getActiveSheet()
  sheet.getRange(cell).setValue(str)
}

function doPost(e) {
  const reaction_type = "pushpin"
  const json = JSON.parse(e.postData.contents)
  if (json.type == "url_verification") {
    return ContentService.createTextOutput(json.challenge)
  } else {
    if (json.token == verificationToken() && json.event.reaction == reaction_type) {
      createNotionPageOnlyProperties(json, reaction_type)
    }
  }
  return ContentService.createTextOutput("Ok")
}

function count_reaction_type(message, reaction_type) {
  return message.reactions.filter(r => r.name == reaction_type).map(r => r.count)[0]
}

function createNotionPageOnlyProperties(json, reaction_type) {
  const message = getSlackMessage(json.event.item.channel, json.event.item.ts).messages[0]
  if (count_reaction_type(message, reaction_type) == 1) {
    outputSheet(message.text, "A1")
    const userDisplayName = getUserDisplayName(json.event.item_user)
    outputSheet(userDisplayName, "A2")
    const channelName = getChannelName(json.event.item.channel)
    outputSheet(channelName, "A3")
    createPage(createPayloadOnlyProperties(message.text, userDisplayName, channelName))
  }
}

function getSlackMessage(channel, ts) {
  return sendSlack("https://slack.com/api/conversations.replies?channel=" + channel + "&ts=" + ts + "&limit=1")
}

function getUserDisplayName(user_id) {
  const profile = sendSlack("https://slack.com/api/users.info?user=" + user_id).user.profile
  return profile.display_name == "" ? profile.real_name : profile.display_name
}

function getChannelName(channel_id) {
  return sendSlack("https://slack.com/api/conversations.info?channel=" + channel_id).channel.name
}

function sendSlack(url) {
  const options = {
    "headers": {
      "Content-type": "application/json; charset=utf-8",
      "Authorization": "Bearer " + botUserOAuthToken(),
    }
  }
  return JSON.parse(UrlFetchApp.fetch(url, options))
}

function sendNotion(url, payload, method) {
  let options = {
    "method": method,
    "headers": {
      "Content-type": "application/json",
      "Authorization": "Bearer " + myNotionToken(),
      "Notion-Version": "2022-06-28",
    },
    "payload": payload ? JSON.stringify(payload) : null
  }
  return JSON.parse(UrlFetchApp.fetch(url, options))
}

function createPage(payload) {
  return sendNotion("https://api.notion.com/v1/pages", payload, "POST")
}

function createPayloadOnlyProperties(message_text, userDisplayNme, channelName) {
  const title = message_text.split("\n")[0]
  const urls = message_text.split(/[<>]/).filter((str) => { console.log(str); return str.startsWith("http") })
  const json = {
    "parent": {
      "database_id": databaseId()
    },
    "properties": {
      "text": {
        "title": [
          {
            "text": {
              "content": title
            }
          }
        ]
      },
      "user_name": {
        "type": "select",
        "select": {
          "name": userDisplayNme
        }
      },
      "channel_name": {
        "type": "select",
        "select": {
          "name": channelName
        }
      },
      "whole_message": {
        "type": "rich_text",
        "rich_text": [
          {
            "text": {
              "content": message_text
            }
          }
        ]
      }
    }
  }
  if (urls.length > 0) {
    json.properties["link"] = {
      "type": "url",
      "url": urls[0]
    }
  }
  return json
}

function myNotionToken() {
  return PropertiesService.getScriptProperties().getProperty("MY_NOTION_TOKEN")
}

function databaseId() {
  return PropertiesService.getScriptProperties().getProperty("DATABASE_ID")
}

function verificationToken() {
  return PropertiesService.getScriptProperties().getProperty("VERIFICATION_TOKEN")
}

function botUserOAuthToken() {
  return PropertiesService.getScriptProperties().getProperty("BOT_USER_OAUTH_TOKEN")
}