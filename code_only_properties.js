// ver 0.3: multiple workspace support
// ver 0.2: add page when the reaction is the first one.
// ver 0.1: first release

function storeTokenAndIds() {
  const scriptProperties = PropertiesService.getScriptProperties()
  scriptProperties.setProperties({
    // "VERIFICATION_TOKEN1": "BOT_USER_OAUTH_TOKEN1",
    // "VERIFICATION_TOKEN2": "BOT_USER_OAUTH_TOKEN2",
    // "VERIFICATION_TOKEN3": "BOT_USER_OAUTH_TOKEN3",
    "@@@ Paste your verification token in Sec.10 @@@@": "@@@ Paste your Bot User OAuth Token in Sec. 10 @@@",
    "MY_NOTION_TOKEN": "@@@ Paste your Integration token @@@",
    "DATABASE_ID": "@@@ Paste your database_id like as 771391e755c245b2a31290f40f187ab9 @@@"
  })
  // Confirm that the above registration was successful
  const properties = PropertiesService.getScriptProperties().getProperties()
  for (let key in properties) {
    console.log(key + " = " + properties[key])
  }
}

function testCreateNotionPage() {
  const message = "Test title\n<https://www.google.com/>"
  const userDisplayName = "test user"
  const channelName = "test channel"
  const teamName = "hkob-labo"
  createPage(createPayloadOnlyProperties(message, userDisplayName, channelName, teamName))
}

function outputSheet(str, cell) {
  const sheet = SpreadsheetApp.getActiveSheet()
  sheet.getRange(cell).setValue(str)
}

function doPost(e) {
  const reactionType = "pushpin"
  const json = JSON.parse(e.postData.contents)
  if (json.type == "url_verification") {
    return ContentService.createTextOutput(json.challenge)
  } else if (json.type == "event_callback") {
    const botToken = slackBotToken(json.token)
    if (botToken && json.event.reaction == reactionType) {
      createNotionPageOnlyProperties(json, reactionType, botToken)
    }
  }
  return ContentService.createTextOutput("Ok")
}

function countReactionType(message, reactionType) {
  return message.reactions.filter(r => r.name == reactionType).map(r => r.count)[0]
}

function createNotionPageOnlyProperties(json, reactionType, botToken) {
  const message = getSlackMessage(json.event.item.channel, json.event.item.ts, botToken).messages[0]
  if (countReactionType(message, reactionType) == 1) {
    outputSheet(message.text, "A1")
    const userDisplayName = getUserDisplayName(json.event.item_user, botToken)
    outputSheet(userDisplayName, "A2")
    const channelName = getChannelName(json.event.item.channel, botToken)
    outputSheet(channelName, "A3")
    const teamName = getTeamName(botToken)
    outputSheet(teamName, "A4")
    createPage(createPayloadOnlyProperties(message.text, userDisplayName, channelName, teamName))
  }
}

function getSlackMessage(channel, ts, botToken) {
  return sendSlack("https://slack.com/api/conversations.replies?channel=" + channel + "&ts=" + ts + "&limit=1", botToken)
}

function getUserDisplayName(user_id, botToken) {
  const profile = sendSlack("https://slack.com/api/users.info?user=" + user_id, botToken).user.profile
  return profile.display_name == "" ? profile.real_name : profile.display_name
}

function getChannelName(channel_id, botToken) {
  return sendSlack("https://slack.com/api/conversations.info?channel=" + channel_id, botToken).channel.name
}

function getTeamName(botToken) {
  return sendSlack("https://slack.com/api/team.info", botToken).team.name
}

function sendSlack(url, botToken) {
  const options = {
    "headers": {
      "Content-type": "application/json; charset=utf-8",
      "Authorization": "Bearer " + botToken
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

function createPayloadOnlyProperties(message_text, userDisplayNme, channelName, teamName) {
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
      "workspace_name": {
        "type": "select",
        "select": {
          "name": teamName
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

function slackBotToken(verificationToken) {
  return PropertiesService.getScriptProperties().getProperty(verificationToken)
}
